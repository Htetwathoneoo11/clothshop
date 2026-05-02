<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOrderManagementTest extends TestCase
{
    use RefreshDatabase;

    private function createVariant(array $attributes = []): ProductVariant
    {
        $product = Product::query()->create([
            'name' => $attributes['product_name'] ?? 'Admin Test Shirt',
            'category' => 'Topwear',
            'brand' => 'Test Brand',
            'is_active' => true,
        ]);

        return $product->variants()->create([
            'color' => $attributes['color'] ?? 'Black',
            'size' => $attributes['size'] ?? 'M',
            'price' => 10,
            'price_mmk' => $attributes['price_mmk'] ?? 30000,
            'stock' => $attributes['stock'] ?? 4,
            'sku' => $attributes['sku'] ?? 'ADMIN-ORDER-1',
        ]);
    }

    private function createOrder(User $user, ProductVariant $variant, array $attributes = []): Order
    {
        $order = Order::query()->create([
            'user_id' => $user->id,
            'total_amount' => $attributes['total_amount'] ?? 10,
            'total_amount_mmk' => $attributes['total_amount_mmk'] ?? 30000,
            'status' => $attributes['status'] ?? Order::STATUS_PENDING,
            'name' => $attributes['name'] ?? 'Customer One',
            'phone_number' => $attributes['phone_number'] ?? '09123456789',
            'delivery_date' => $attributes['delivery_date'] ?? now()->addDay()->toDateString(),
            'delivery_time' => $attributes['delivery_time'] ?? '10:00',
            'building_or_flat' => 'A-1',
            'street_or_road' => 'Main Road',
            'township' => 'Central',
            'city' => $attributes['city'] ?? 'Yangon',
            'payment_method' => $attributes['payment_method'] ?? Order::PAYMENT_CASH_ON_DELIVERY,
        ]);

        $order->items()->create([
            'product_variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => 10,
            'line_total' => 10,
            'unit_price_mmk' => $attributes['total_amount_mmk'] ?? 30000,
            'line_total_mmk' => $attributes['total_amount_mmk'] ?? 30000,
        ]);

        return $order;
    }

    public function test_admin_order_routes_require_admin_access(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        $variant = $this->createVariant();
        $order = $this->createOrder($user, $variant);

        $this->getJson('/api/admin/dashboard')->assertUnauthorized();
        $this->getJson('/api/admin/orders')->assertUnauthorized();
        $this->patchJson('/api/admin/orders/'.$order->id.'/status', [
            'status' => Order::STATUS_PAID,
        ])->assertUnauthorized();

        $this->actingAs($user)->getJson('/api/admin/dashboard')->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/orders')->assertForbidden();
    }

    public function test_admin_dashboard_returns_store_metrics_and_recent_orders(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create(['role' => User::ROLE_USER]);
        $variant = $this->createVariant(['stock' => 3]);
        $this->createOrder($customer, $variant, [
            'status' => Order::STATUS_PAID,
            'total_amount_mmk' => 45000,
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('metrics.orders.total', 1)
            ->assertJsonPath('metrics.orders.paid', 1)
            ->assertJsonPath('metrics.orders.paid_revenue_mmk', 45000)
            ->assertJsonPath('metrics.inventory.low_stock_variants', 1)
            ->assertJsonPath('metrics.users.admins', 1)
            ->assertJsonPath('recent_orders.0.customer.id', $customer->id);
    }

    public function test_admin_can_filter_orders_and_update_status(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create([
            'role' => User::ROLE_USER,
            'username' => 'maya',
            'credit_score' => 0,
        ]);
        $variant = $this->createVariant();
        $pending = $this->createOrder($customer, $variant, [
            'name' => 'Maya Customer',
            'status' => Order::STATUS_PENDING,
            'total_amount_mmk' => 500000,
            'payment_method' => Order::PAYMENT_CASH_ON_DELIVERY,
        ]);
        $this->createOrder($customer, $variant, [
            'name' => 'Hidden Customer',
            'status' => Order::STATUS_CANCELLED,
            'total_amount_mmk' => 10000,
            'payment_method' => Order::PAYMENT_CARD_ON_DELIVERY,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/orders?status=pending&q=maya')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('orders.0.id', $pending->id)
            ->assertJsonPath('orders.0.customer.username', 'maya');

        $this->actingAs($admin)
            ->patchJson('/api/admin/orders/'.$pending->id.'/status', [
                'status' => Order::STATUS_PAID,
            ])
            ->assertOk()
            ->assertJsonPath('order.status', Order::STATUS_PAID)
            ->assertJsonPath('order.credit_earned_mmk', 500000);

        $this->assertDatabaseHas('orders', [
            'id' => $pending->id,
            'status' => Order::STATUS_PAID,
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'credit_score' => 500000,
        ]);
        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'order.status_update',
            'target_type' => 'order',
            'target_id' => $pending->id,
        ]);

        $this->assertSame(1, AdminActivityLog::query()->where('action', 'order.status_update')->count());
    }
}
