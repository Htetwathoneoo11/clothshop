<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('name')->nullable()->after('status');
            $table->string('phone_number', 50)->nullable()->after('name');
            $table->date('delivery_date')->nullable()->after('phone_number');
            $table->string('delivery_time', 20)->nullable()->after('delivery_date');
            $table->string('building_or_flat')->nullable()->after('delivery_time');
            $table->string('street_or_road')->nullable()->after('building_or_flat');
            $table->string('township')->nullable()->after('street_or_road');
            $table->string('city')->nullable()->after('township');
            $table->string('payment_method', 50)->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'name',
                'phone_number',
                'delivery_date',
                'delivery_time',
                'building_or_flat',
                'street_or_road',
                'township',
                'city',
                'payment_method',
            ]);
        });
    }
};
