<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code')->unique();
            $table->unsignedTinyInteger('discount_percent')->default(10);
            $table->unsignedBigInteger('threshold_mmk')->default(500000);
            $table->timestamp('used_at')->nullable()->index();
            $table->foreignId('used_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->foreignId('coupon_id')->nullable()->after('user_id')->constrained('coupons')->nullOnDelete();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('coupon_code')->nullable()->after('payment_method');
            $table->unsignedTinyInteger('coupon_discount_percent')->default(0)->after('coupon_code');
            $table->unsignedBigInteger('discount_mmk')->default(0)->after('coupon_discount_percent');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'coupon_code',
                'coupon_discount_percent',
                'discount_mmk',
            ]);
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('coupon_id');
        });

        Schema::dropIfExists('coupons');
    }
};
