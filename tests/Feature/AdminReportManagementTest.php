<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminReportManagementTest extends TestCase
{
    use RefreshDatabase;

    private function createVariant(array $variantAttributes = [], array $productAttributes = []): ProductVariant
    {
        $product = Product::query()->create(array_merge([
            'name' => 'Report Test Jacket',
            'category' => 'Outerwear',
            'brand' => 'Report Brand',
            'is_active' => true,
        ], $productAttributes));

        return $product->variants()->create(array_merge([
            'color' => 'Black',
            'size' => 'M',
            'price' => 10,
            'price_mmk' => 50000,
            'stock' => 3,
            'sku' => 'REPORT-JACKET',
        ], $variantAttributes));
    }

    private function createOrder(User $user, ProductVariant $variant, array $attributes = []): Order
    {
        $createdAt = $attributes['created_at'] ?? now()->subDays(3);
        $totalMmk = $attributes['total_amount_mmk'] ?? 100000;
        $quantity = $attributes['quantity'] ?? 1;

        $order = Order::query()->create([
            'user_id' => $user->id,
            'total_amount' => $attributes['total_amount'] ?? 10,
            'total_amount_mmk' => $totalMmk,
            'discount_mmk' => $attributes['discount_mmk'] ?? 0,
            'status' => $attributes['status'] ?? Order::STATUS_PAID,
            'name' => $attributes['name'] ?? 'Report Customer',
            'phone_number' => '09123456789',
            'delivery_date' => now()->addDay()->toDateString(),
            'delivery_time' => '10:00',
            'building_or_flat' => 'A-1',
            'street_or_road' => 'Main Road',
            'township' => 'Central',
            'city' => 'Yangon',
            'payment_method' => $attributes['payment_method'] ?? Order::PAYMENT_CASH_ON_DELIVERY,
        ]);

        $order->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ])->save();

        $order->items()->create([
            'product_variant_id' => $variant->id,
            'quantity' => $quantity,
            'unit_price' => 10,
            'line_total' => 10 * $quantity,
            'unit_price_mmk' => intdiv($totalMmk, max(1, $quantity)),
            'line_total_mmk' => $totalMmk,
        ]);

        return $order;
    }

    public function test_admin_report_route_requires_admin_access(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $this->getJson('/api/admin/reports')->assertUnauthorized();
        $this->actingAs($user)->getJson('/api/admin/reports')->assertForbidden();
    }

    public function test_admin_report_returns_sales_customer_product_and_inventory_metrics(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create([
            'role' => User::ROLE_USER,
            'username' => 'maya',
            'created_at' => now()->subDays(5),
        ]);
        User::factory()->create([
            'role' => User::ROLE_USER,
            'created_at' => now()->subDays(40),
        ]);

        $jacket = $this->createVariant(['stock' => 3, 'sku' => 'REPORT-JACKET']);
        $shirt = $this->createVariant(
            ['stock' => 0, 'sku' => 'REPORT-SHIRT'],
            ['name' => 'Report Test Shirt', 'category' => 'Topwear']
        );

        $this->createOrder($customer, $jacket, [
            'total_amount_mmk' => 100000,
            'discount_mmk' => 10000,
            'quantity' => 2,
            'created_at' => now()->subDays(3),
        ]);
        $this->createOrder($customer, $shirt, [
            'total_amount_mmk' => 50000,
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
            'created_at' => now()->subDays(2),
        ]);
        $this->createOrder($customer, $jacket, [
            'total_amount_mmk' => 25000,
            'status' => Order::STATUS_PENDING,
            'created_at' => now()->subDay(),
        ]);
        $this->createOrder($customer, $jacket, [
            'total_amount_mmk' => 40000,
            'created_at' => now()->subDays(40),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/reports?days=30')
            ->assertOk()
            ->assertJsonPath('range.days', 30)
            ->assertJsonPath('summary.paid_revenue_mmk', 150000)
            ->assertJsonPath('summary.orders_total', 3)
            ->assertJsonPath('summary.orders_paid', 2)
            ->assertJsonPath('summary.average_order_value_mmk', 75000)
            ->assertJsonPath('summary.discounts_mmk', 10000)
            ->assertJsonPath('summary.new_customers', 1)
            ->assertJsonPath('orders_by_status.0.status', Order::STATUS_PENDING)
            ->assertJsonPath('orders_by_status.0.count', 1)
            ->assertJsonPath('orders_by_status.1.status', Order::STATUS_PAID)
            ->assertJsonPath('orders_by_status.1.count', 2)
            ->assertJsonPath('top_products.0.name', 'Report Test Jacket')
            ->assertJsonPath('top_products.0.units_sold', 2)
            ->assertJsonPath('inventory.total_units', 3)
            ->assertJsonPath('inventory.low_stock_variants', 1)
            ->assertJsonPath('inventory.out_of_stock_variants', 1)
            ->assertJsonPath('customers.active_customers', 1)
            ->assertJsonPath('customers.repeat_customers', 1)
            ->assertJsonPath('customers.top_customers.0.username', 'maya')
            ->assertJsonPath('customers.top_customers.0.spend_mmk', 150000)
            ->assertJsonCount(30, 'sales_trend');
    }
}
