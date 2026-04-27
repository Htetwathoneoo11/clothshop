<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Normalize invalid role values to ROLE_USER (1). Valid roles: 1 (user), 2 (admin).
     */
    public function up(): void
    {
        DB::table('users')->where(function ($query) {
            $query->whereNull('role')
                ->orWhereNotIn('role', [1, 2]);
        })->update(['role' => 1]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Data migration; no safe automatic rollback.
    }
};
