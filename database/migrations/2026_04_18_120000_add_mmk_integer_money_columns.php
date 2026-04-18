<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add integer MMK columns and backfill from legacy USD decimals.
     *
     * TODO: follow-up migration to drop legacy decimal columns (price, unit_price, line_total, total_amount)
     * once all API consumers use MMK integers only.
     */
    public function up(): void
    {
        $rate = max(1, (int) config('money.mmk_per_usd', (int) env('MMK_PER_USD', 2100)));

        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('price_mmk')->default(0);
        });

        Schema::table('cart_items', function (Blueprint $table) {
            $table->unsignedBigInteger('unit_price_mmk')->default(0);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedBigInteger('total_amount_mmk')->default(0);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('unit_price_mmk')->default(0);
            $table->unsignedBigInteger('line_total_mmk')->default(0);
        });

        $this->backfillMmk($rate);
        $this->addMmkCheckConstraints();
    }

    public function down(): void
    {
        $this->dropMmkCheckConstraints();

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['unit_price_mmk', 'line_total_mmk']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('total_amount_mmk');
        });

        Schema::table('cart_items', function (Blueprint $table) {
            $table->dropColumn('unit_price_mmk');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('price_mmk');
        });
    }

    private function backfillMmk(int $rate): void
    {
        DB::table('product_variants')->orderBy('id')->chunkById(200, function ($rows) use ($rate): void {
            foreach ($rows as $row) {
                $mmk = (int) round((float) $row->price * $rate);
                DB::table('product_variants')->where('id', $row->id)->update(['price_mmk' => $mmk]);
            }
        });

        DB::table('cart_items')->orderBy('id')->chunkById(200, function ($rows) use ($rate): void {
            foreach ($rows as $row) {
                $mmk = (int) round((float) $row->unit_price * $rate);
                DB::table('cart_items')->where('id', $row->id)->update(['unit_price_mmk' => $mmk]);
            }
        });

        DB::table('order_items')->orderBy('id')->chunkById(200, function ($rows) use ($rate): void {
            foreach ($rows as $row) {
                $unitMmk = (int) round((float) $row->unit_price * $rate);
                $lineMmk = (int) $row->quantity * $unitMmk;
                DB::table('order_items')->where('id', $row->id)->update([
                    'unit_price_mmk' => $unitMmk,
                    'line_total_mmk' => $lineMmk,
                ]);
            }
        });

        DB::table('orders')->orderBy('id')->chunkById(200, function ($rows): void {
            foreach ($rows as $row) {
                $sum = (int) DB::table('order_items')->where('order_id', $row->id)->sum('line_total_mmk');
                DB::table('orders')->where('id', $row->id)->update(['total_amount_mmk' => $sum]);
            }
        });
    }

    private function addMmkCheckConstraints(): void
    {
        $driver = DB::getDriverName();

        if (! in_array($driver, ['mysql', 'pgsql', 'sqlite'], true)) {
            return;
        }

        $this->statement('ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_price_mmk_non_negative CHECK (price_mmk >= 0)');
        $this->statement('ALTER TABLE cart_items ADD CONSTRAINT chk_cart_items_unit_price_mmk_non_negative CHECK (unit_price_mmk >= 0)');
        $this->statement('ALTER TABLE orders ADD CONSTRAINT chk_orders_total_amount_mmk_non_negative CHECK (total_amount_mmk >= 0)');
        $this->statement('ALTER TABLE order_items ADD CONSTRAINT chk_order_items_unit_price_mmk_non_negative CHECK (unit_price_mmk >= 0)');
        $this->statement('ALTER TABLE order_items ADD CONSTRAINT chk_order_items_line_total_mmk_non_negative CHECK (line_total_mmk >= 0)');
        $this->statement('ALTER TABLE order_items ADD CONSTRAINT chk_order_items_line_total_mmk_consistent CHECK (line_total_mmk = quantity * unit_price_mmk)');
    }

    private function dropMmkCheckConstraints(): void
    {
        $driver = DB::getDriverName();

        if (! in_array($driver, ['mysql', 'pgsql', 'sqlite'], true)) {
            return;
        }

        $this->dropConstraint('product_variants', 'chk_product_variants_price_mmk_non_negative');
        $this->dropConstraint('cart_items', 'chk_cart_items_unit_price_mmk_non_negative');
        $this->dropConstraint('orders', 'chk_orders_total_amount_mmk_non_negative');
        $this->dropConstraint('order_items', 'chk_order_items_unit_price_mmk_non_negative');
        $this->dropConstraint('order_items', 'chk_order_items_line_total_mmk_non_negative');
        $this->dropConstraint('order_items', 'chk_order_items_line_total_mmk_consistent');
    }

    private function statement(string $sql): void
    {
        try {
            DB::statement($sql);
        } catch (\Throwable) {
            // Constraint may already exist or engine may reject; keep migration non-breaking.
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
