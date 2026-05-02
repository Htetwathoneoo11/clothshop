<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\AdminNotificationReview;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function createVariant(array $variantAttributes = []): ProductVariant
    {
        $product = Product::query()->create([
            'name' => 'Notification Test Tee',
            'category' => 'Topwear',
            'brand' => 'Alert Brand',
            'is_active' => true,
        ]);

        return $product->variants()->create(array_merge([
            'color' => 'Black',
            'size' => 'M',
            'price' => 10,
            'price_mmk' => 50000,
            'stock' => 0,
            'sku' => 'ALERT-TEE',
        ], $variantAttributes));
    }

    private function createOrder(User $user, array $attributes = []): Order
    {
        return Order::query()->create([
            'user_id' => $user->id,
            'total_amount' => 10,
            'total_amount_mmk' => $attributes['total_amount_mmk'] ?? 50000,
            'status' => $attributes['status'] ?? Order::STATUS_PENDING,
            'name' => 'Alert Customer',
            'phone_number' => '09123456789',
            'payment_method' => $attributes['payment_method'] ?? Order::PAYMENT_CASH_ON_DELIVERY,
        ]);
    }

    public function test_admin_notifications_require_notification_permission(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_USER]);
        $support = User::factory()->create(['role' => User::ROLE_SUPPORT]);

        $this->getJson('/api/admin/notifications')->assertUnauthorized();
        $this->actingAs($customer)->getJson('/api/admin/notifications')->assertForbidden();
        $this->actingAs($support)->getJson('/api/admin/notifications')->assertOk();
    }

    public function test_notifications_include_inventory_payment_order_and_security_alerts(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'username' => 'root']);
        $customer = User::factory()->create(['role' => User::ROLE_USER, 'username' => 'maya']);
        $this->createVariant(['stock' => 0, 'sku' => 'OUT-1']);
        $this->createVariant(['stock' => 3, 'sku' => 'LOW-1']);
        $this->createOrder($customer, [
            'status' => Order::STATUS_FAILED,
            'total_amount_mmk' => 90000,
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
        ]);
        $this->createOrder($customer, [
            'status' => Order::STATUS_PENDING,
            'total_amount_mmk' => 700000,
        ]);
        $auditLog = AdminActivityLog::query()->create([
            'actor_id' => $admin->id,
            'action' => 'user.role_update',
            'target_type' => 'user',
            'target_id' => $customer->id,
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('counts.critical', 2)
            ->assertJsonPath('counts.warning', 3);

        $types = collect($response->json('notifications'))->pluck('type');
        $notifications = collect($response->json('notifications'))->keyBy('type');

        $this->assertTrue($types->contains('out_of_stock'));
        $this->assertTrue($types->contains('low_stock'));
        $this->assertTrue($types->contains('failed_payment'));
        $this->assertTrue($types->contains('high_value_order'));
        $this->assertTrue($types->contains('security_review'));
        $this->assertSame('/admin/audit-logs/'.$auditLog->id, $notifications['security_review']['action_url']);
        $this->assertStringStartsWith('/admin/orders/', $notifications['failed_payment']['action_url']);
        $this->assertStringStartsWith('/admin/orders/', $notifications['high_value_order']['action_url']);
    }

    public function test_reviewed_notification_disappears_from_active_notifications(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $this->createVariant(['stock' => 0, 'sku' => 'REVIEW-ME']);

        $initial = $this->actingAs($admin)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('counts.total', 1);

        $notification = $initial->json('notifications.0');

        $this->actingAs($admin)
            ->postJson('/api/admin/notifications/'.$notification['id'].'/review')
            ->assertOk()
            ->assertJsonPath('message', 'Notification marked as reviewed.')
            ->assertJsonPath('counts.total', 0)
            ->assertJsonCount(0, 'notifications')
            ->assertJsonPath('recent_reviews.0.action_url', $notification['action_url']);

        $this->assertDatabaseHas('admin_notification_reviews', [
            'notification_id' => $notification['id'],
            'reviewed_by' => $admin->id,
            'type' => 'out_of_stock',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('counts.total', 0)
            ->assertJsonCount(0, 'notifications');
    }

    public function test_bulk_review_and_review_history(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'username' => 'reviewer']);
        $this->createVariant(['stock' => 0, 'sku' => 'BULK-OUT']);
        $this->createVariant(['stock' => 2, 'sku' => 'BULK-LOW']);

        $initial = $this->actingAs($admin)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonPath('counts.total', 2);

        $ids = collect($initial->json('notifications'))->pluck('id')->all();

        $this->actingAs($admin)
            ->postJson('/api/admin/notifications/bulk-review', [
                'notification_ids' => $ids,
            ])
            ->assertOk()
            ->assertJsonPath('counts.total', 0)
            ->assertJsonCount(2, 'recent_reviews');

        $this->actingAs($admin)
            ->getJson('/api/admin/notifications/reviews')
            ->assertOk()
            ->assertJsonCount(2, 'reviews')
            ->assertJsonPath('reviews.0.reviewer.username', 'reviewer')
            ->assertJsonFragment(['action_url' => '/admin/inventory?variant_id=1&focus=variant'])
            ->assertJsonFragment(['action_url' => '/admin/inventory?variant_id=2&focus=variant']);
    }

    public function test_review_history_returns_the_full_archive(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        foreach (range(1, 35) as $index) {
            AdminNotificationReview::query()->create([
                'notification_id' => 'archive-'.$index,
                'reviewed_by' => $admin->id,
                'type' => 'low_stock',
                'priority' => 'warning',
                'title' => 'Archived alert '.$index,
                'target_type' => 'product_variant',
                'target_id' => $index,
                'snapshot' => [
                    'action_url' => '/admin/inventory?variant_id='.$index.'&focus=variant',
                ],
                'reviewed_at' => now()->subMinutes($index),
            ]);
        }

        $this->actingAs($admin)
            ->getJson('/api/admin/notifications/reviews')
            ->assertOk()
            ->assertJsonCount(35, 'reviews')
            ->assertJsonFragment(['notification_id' => 'archive-35']);
    }
}
