<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where(function ($query) {
            $query->whereNull('role')
                ->orWhereNotIn('role', [1, 2, 3, 4, 5]);
        })->update(['role' => 1]);
    }

    public function down(): void
    {
        // Data normalization only.
    }
};
