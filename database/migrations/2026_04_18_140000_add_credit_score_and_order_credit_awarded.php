<?php

use App\Models\Order;
use App\Support\MmkMoney;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Credit score (MMK) on users; idempotent credit awards on paid orders.
     *
     * TODO: consider tightening legacy fields once all orders have reliable total_amount_mmk.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('credit_score')->default(0);
            $table->index('credit_score');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('credit_awarded_at')->nullable();
            $table->index('credit_awarded_at');
        });

        $this->backfillExistingCredits();
        $this->addCheckConstraints();
    }

    public function down(): void
    {
        $this->dropCheckConstraints();

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['credit_awarded_at']);
            $table->dropColumn('credit_awarded_at');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['credit_score']);
            $table->dropColumn('credit_score');
        });
    }

    private function backfillExistingCredits(): void
    {
        $rate = max(1, (int) config('money.mmk_per_usd', (int) env('MMK_PER_USD', 2100)));

        $paidStatus = Order::STATUS_PAID;

        $rows = DB::table('orders')
            ->where('status', $paidStatus)
            ->whereNull('credit_awarded_at')
            ->orderBy('id')
            ->get(['id', 'user_id', 'total_amount_mmk', 'total_amount']);

        $perUser = [];

        foreach ($rows as $row) {
            $mmk = (int) $row->total_amount_mmk;
            if ($mmk <= 0 && $row->total_amount !== null) {
                $mmk = MmkMoney::usdDecimalToMmk((string) $row->total_amount);
            }
            if ($mmk < 0) {
                $mmk = 0;
            }
            $uid = (int) $row->user_id;
            $perUser[$uid] = ($perUser[$uid] ?? 0) + $mmk;
        }

        foreach ($perUser as $userId => $add) {
            if ($add > 0) {
                DB::table('users')->where('id', $userId)->increment('credit_score', $add);
            }
        }

        DB::table('orders')
            ->where('status', $paidStatus)
            ->whereNull('credit_awarded_at')
            ->update(['credit_awarded_at' => now()]);
    }

    private function addCheckConstraints(): void
    {
        $driver = DB::getDriverName();

        if (! in_array($driver, ['mysql', 'pgsql', 'sqlite'], true)) {
            return;
        }

        $this->statement('ALTER TABLE users ADD CONSTRAINT chk_users_credit_score_non_negative CHECK (credit_score >= 0)');
    }

    private function dropCheckConstraints(): void
    {
        $driver = DB::getDriverName();

        if (! in_array($driver, ['mysql', 'pgsql', 'sqlite'], true)) {
            return;
        }

        $this->dropConstraint('users', 'chk_users_credit_score_non_negative');
    }

    private function statement(string $sql): void
    {
        try {
            DB::statement($sql);
        } catch (\Throwable) {
        }
    }

    private function dropConstraint(string $table, string $constraint): void
    {
        try {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$constraint}");
        } catch (\Throwable) {
            try {
                DB::statement("ALTER TABLE {$table} DROP CHECK {$constraint}");
            } catch (\Throwable) {
            }
        }
    }
};
