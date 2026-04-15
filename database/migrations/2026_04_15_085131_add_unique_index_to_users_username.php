<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'username')) {
            return;
        }

        $duplicates = DB::table('users')
            ->select('username')
            ->groupBy('username')
            ->havingRaw('COUNT(*) > 1')
            ->limit(1)
            ->exists();

        if ($duplicates) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->unique('username');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        try {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique('users_username_unique');
            });
        } catch (\Throwable $e) {
            // Index may not exist if migration skipped due duplicate usernames.
        }
    }
};
