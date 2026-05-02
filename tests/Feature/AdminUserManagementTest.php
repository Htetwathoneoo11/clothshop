<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\AdminNotificationReview;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StaffInvitation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUserManagementTest extends TestCase
{
    use RefreshDatabase;

    private function createVariant(): ProductVariant
    {
        $product = Product::query()->create([
            'name' => 'User Admin Test Shirt',
            'category' => 'Topwear',
            'is_active' => true,
        ]);

        return $product->variants()->create([
            'color' => 'Black',
            'size' => 'M',
            'price' => 10,
            'price_mmk' => 30000,
            'stock' => 5,
            'sku' => 'USER-ADMIN-1',
        ]);
    }

    private function createOrder(User $user, ProductVariant $variant, array $attributes = []): Order
    {
        $order = Order::query()->create([
            'user_id' => $user->id,
            'total_amount' => 10,
            'total_amount_mmk' => $attributes['total_amount_mmk'] ?? 30000,
            'status' => $attributes['status'] ?? Order::STATUS_PAID,
            'name' => 'Customer Name',
            'phone_number' => '09123456789',
            'payment_method' => Order::PAYMENT_CASH_ON_DELIVERY,
        ]);

        $order->items()->create([
            'product_variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => 10,
            'line_total' => 10,
            'unit_price_mmk' => $order->total_amount_mmk,
            'line_total_mmk' => $order->total_amount_mmk,
        ]);

        return $order;
    }

    public function test_admin_user_routes_require_admin_access(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);

        $this->getJson('/api/admin/users')->assertUnauthorized();
        $this->getJson('/api/admin/users/'.$user->id)->assertUnauthorized();
        $this->patchJson('/api/admin/users/'.$user->id.'/status', ['status' => 0])->assertUnauthorized();
        $this->patchJson('/api/admin/users/'.$user->id.'/role', ['role' => User::ROLE_ADMIN])->assertUnauthorized();

        $this->actingAs($user)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/users/'.$user->id)->assertForbidden();
    }

    public function test_admin_can_search_filter_and_view_user_details(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create([
            'username' => 'maya',
            'email' => 'maya@example.test',
            'role' => User::ROLE_USER,
            'status' => 1,
            'credit_score' => 500000,
            'last_login_at' => now()->subHour(),
            'last_login_ip' => '127.0.0.1',
        ]);
        User::factory()->create([
            'username' => 'hidden-admin',
            'role' => User::ROLE_ADMIN,
            'status' => 0,
        ]);

        $variant = $this->createVariant();
        $this->createOrder($customer, $variant, ['total_amount_mmk' => 45000]);
        Coupon::query()->create([
            'user_id' => $customer->id,
            'code' => 'LOYAL10-'.$customer->id,
            'discount_percent' => 10,
            'threshold_mmk' => 500000,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/users?role=user&status=active&q=maya')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('users.0.username', 'maya')
            ->assertJsonPath('users.0.orders_count', 1)
            ->assertJsonPath('users.0.paid_spend_mmk', 45000)
            ->assertJsonPath('users.0.last_login_ip', '127.0.0.1')
            ->assertJsonPath('role_matrix.roles.0.label', 'Super Admin')
            ->assertJsonPath('role_matrix.permissions.0.key', 'manage_users');

        $this->actingAs($admin)
            ->getJson('/api/admin/users/'.$customer->id)
            ->assertOk()
            ->assertJsonPath('user.username', 'maya')
            ->assertJsonPath('user.orders.0.total_amount_mmk', 45000)
            ->assertJsonPath('user.coupons.0.code', 'LOYAL10-'.$customer->id);
    }

    public function test_admin_can_view_user_admin_activity_timeline(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'username' => 'root-admin']);
        $customer = User::factory()->create([
            'username' => 'timeline-user',
            'email' => 'timeline@example.test',
            'role' => User::ROLE_SUPPORT,
        ]);

        AdminActivityLog::query()->create([
            'actor_id' => $admin->id,
            'action' => 'user.role_update',
            'target_type' => 'user',
            'target_id' => $customer->id,
            'before_state' => ['role' => User::ROLE_USER],
            'after_state' => ['role' => User::ROLE_SUPPORT],
            'meta' => ['ip' => '127.0.0.1'],
        ]);

        StaffInvitation::query()->create([
            'username' => $customer->username,
            'email' => $customer->email,
            'role' => User::ROLE_SUPPORT,
            'token_hash' => hash('sha256', 'timeline-token'),
            'invited_by' => $admin->id,
            'accepted_user_id' => $customer->id,
            'expires_at' => now()->addDay(),
            'accepted_at' => now(),
        ]);

        AdminNotificationReview::query()->create([
            'notification_id' => 'busy-admin-'.$customer->id,
            'reviewed_by' => $customer->id,
            'type' => 'admin_activity_spike',
            'priority' => 'warning',
            'title' => 'Admin activity spike',
            'target_type' => 'user',
            'target_id' => $customer->id,
            'snapshot' => ['id' => 'busy-admin-'.$customer->id],
            'reviewed_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/users/'.$customer->id)
            ->assertOk()
            ->assertJsonFragment(['title' => 'Role changed'])
            ->assertJsonFragment(['title' => 'Received staff invitation'])
            ->assertJsonFragment(['title' => 'Reviewed notification']);
    }

    public function test_admin_can_update_user_status_and_role_with_audit_logs(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create([
            'role' => User::ROLE_USER,
            'status' => 1,
        ]);

        $this->actingAs($admin)
            ->patchJson('/api/admin/users/'.$customer->id.'/status', ['status' => 0])
            ->assertOk()
            ->assertJsonPath('user.status', 0)
            ->assertJsonPath('user.status_label', 'Restricted');

        $this->actingAs($admin)
            ->patchJson('/api/admin/users/'.$customer->id.'/role', ['role' => User::ROLE_ADMIN])
            ->assertOk()
            ->assertJsonPath('user.role', User::ROLE_ADMIN)
            ->assertJsonPath('user.role_label', 'Super Admin');

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'role' => User::ROLE_ADMIN,
            'status' => 0,
        ]);
        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'user.status_update',
            'target_type' => 'user',
            'target_id' => $customer->id,
        ]);
        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'user.role_update',
            'target_type' => 'user',
            'target_id' => $customer->id,
        ]);

        $this->assertSame(2, AdminActivityLog::query()->where('target_id', $customer->id)->count());
    }

    public function test_admin_cannot_change_own_role_or_status(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'status' => 1]);

        $this->actingAs($admin)
            ->patchJson('/api/admin/users/'.$admin->id.'/status', ['status' => 0])
            ->assertStatus(422)
            ->assertJsonPath('message', 'You cannot change your own account status from admin user management.');

        $this->actingAs($admin)
            ->patchJson('/api/admin/users/'.$admin->id.'/role', ['role' => User::ROLE_USER])
            ->assertStatus(422)
            ->assertJsonPath('message', 'You cannot change your own role from admin user management.');

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'role' => User::ROLE_ADMIN,
            'status' => 1,
        ]);
    }
}
