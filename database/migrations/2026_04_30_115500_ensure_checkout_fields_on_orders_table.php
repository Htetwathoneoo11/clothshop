<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'name')) {
                $table->string('name')->nullable()->after('status');
            }
            if (! Schema::hasColumn('orders', 'phone_number')) {
                $table->string('phone_number', 50)->nullable()->after('name');
            }
            if (! Schema::hasColumn('orders', 'delivery_date')) {
                $table->date('delivery_date')->nullable()->after('phone_number');
            }
            if (! Schema::hasColumn('orders', 'delivery_time')) {
                $table->string('delivery_time', 20)->nullable()->after('delivery_date');
            }
            if (! Schema::hasColumn('orders', 'building_or_flat')) {
                $table->string('building_or_flat')->nullable()->after('delivery_time');
            }
            if (! Schema::hasColumn('orders', 'street_or_road')) {
                $table->string('street_or_road')->nullable()->after('building_or_flat');
            }
            if (! Schema::hasColumn('orders', 'township')) {
                $table->string('township')->nullable()->after('street_or_road');
            }
            if (! Schema::hasColumn('orders', 'city')) {
                $table->string('city')->nullable()->after('township');
            }
            if (! Schema::hasColumn('orders', 'payment_method')) {
                $table->string('payment_method', 50)->nullable()->after('city');
            }
        });
    }

    public function down(): void
    {
        // Repair migration: intentionally keeps checkout columns in place on rollback.
    }
};
