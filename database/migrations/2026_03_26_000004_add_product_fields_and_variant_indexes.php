<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('category')->default('General')->after('name');
            $table->string('brand')->nullable()->after('category');
            $table->string('image_url')->nullable()->after('description');
            $table->boolean('is_active')->default(true)->after('image_url');

            $table->index('category');
            $table->index('is_active');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->index(['color', 'size']);
            $table->index('stock');
        });
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropIndex(['color', 'size']);
            $table->dropIndex(['stock']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['category']);
            $table->dropIndex(['is_active']);
            $table->dropColumn(['category', 'brand', 'image_url', 'is_active']);
        });
    }
};
