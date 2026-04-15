<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if (! in_array($driver, ['mysql', 'pgsql'], true)) {
            return;
        }

        $this->statement('ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_stock_non_negative CHECK (stock >= 0)');
        $this->statement('ALTER TABLE cart_items ADD CONSTRAINT chk_cart_items_quantity_positive CHECK (quantity >= 1)');
        $this->statement('ALTER TABLE cart_items ADD CONSTRAINT chk_cart_items_unit_price_non_negative CHECK (unit_price >= 0)');
        $this->statement('ALTER TABLE orders ADD CONSTRAINT chk_orders_total_amount_non_negative CHECK (total_amount >= 0)');
        $this->statement("ALTER TABLE orders ADD CONSTRAINT chk_orders_status_allowed CHECK (status IN ('pending','paid','failed','cancelled'))");
        $this->statement('ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity_positive CHECK (quantity >= 1)');
        $this->statement('ALTER TABLE order_items ADD CONSTRAINT chk_order_items_unit_price_non_negative CHECK (unit_price >= 0)');
        $this->statement('ALTER TABLE order_items ADD CONSTRAINT chk_order_items_line_total_non_negative CHECK (line_total >= 0)');
        $this->statement('ALTER TABLE order_items ADD CONSTRAINT chk_order_items_line_total_consistent CHECK (line_total = ROUND(quantity * unit_price, 2))');
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if (! in_array($driver, ['mysql', 'pgsql'], true)) {
            return;
        }

        $this->dropConstraint('product_variants', 'chk_product_variants_stock_non_negative');
        $this->dropConstraint('cart_items', 'chk_cart_items_quantity_positive');
        $this->dropConstraint('cart_items', 'chk_cart_items_unit_price_non_negative');
        $this->dropConstraint('orders', 'chk_orders_total_amount_non_negative');
        $this->dropConstraint('orders', 'chk_orders_status_allowed');
        $this->dropConstraint('order_items', 'chk_order_items_quantity_positive');
        $this->dropConstraint('order_items', 'chk_order_items_unit_price_non_negative');
        $this->dropConstraint('order_items', 'chk_order_items_line_total_non_negative');
        $this->dropConstraint('order_items', 'chk_order_items_line_total_consistent');
    }

    private function statement(string $sql): void
    {
        try {
            DB::statement($sql);
        } catch (\Throwable $e) {
            // Constraint may already exist or DB engine may reject syntax; keep migration non-breaking.
        }
    }

    private function dropConstraint(string $table, string $constraint): void
    {
        try {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$constraint}");
        } catch (\Throwable $e) {
            try {
                DB::statement("ALTER TABLE {$table} DROP CHECK {$constraint}");
            } catch (\Throwable $e2) {
                // Constraint may not exist on this database.
            }
        }
    }
};
