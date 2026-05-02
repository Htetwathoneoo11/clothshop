<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCouponManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_coupon_routes_require_admin_access(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        $coupon = Coupon::query()->create([
            'user_id' => $user->id,
            'code' => 'LOYAL10-'.$user->id,
            'discount_percent' => 10,
            'threshold_mmk' => 500000,
        ]);

        $this->getJson('/api/admin/coupons')->assertUnauthorized();
        $this->getJson('/api/admin/coupons/'.$coupon->id)->assertUnauthorized();
        $this->postJson('/api/admin/coupons', [])->assertUnauthorized();
        $this->patchJson('/api/admin/coupons/'.$coupon->id.'/expire')->assertUnauthorized();

        $this->actingAs($user)->getJson('/api/admin/coupons')->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/coupons/'.$coupon->id)->assertForbidden();
    }

    public function test_admin_can_filter_and_view_coupons(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create([
            'role' => User::ROLE_USER,
            'username' => 'maya',
            'credit_score' => 500000,
        ]);
        $coupon = Coupon::query()->create([
            'user_id' => $customer->id,
            'code' => 'LOYAL10-'.$customer->id,
            'discount_percent' => 10,
            'threshold_mmk' => 500000,
        ]);
        Coupon::query()->create([
            'user_id' => $customer->id,
            'code' => 'EXPIRED-'.$customer->id,
            'discount_percent' => 15,
            'threshold_mmk' => 1000000,
            'expires_at' => now()->subDay(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/coupons?status=available&q=maya')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('coupons.0.id', $coupon->id)
            ->assertJsonPath('coupons.0.user.username', 'maya')
            ->assertJsonPath('reward_tiers.0.threshold_mmk', 500000);

        $this->actingAs($admin)
            ->getJson('/api/admin/coupons/'.$coupon->id)
            ->assertOk()
            ->assertJsonPath('coupon.code', 'LOYAL10-'.$customer->id)
            ->assertJsonPath('coupon.status', 'available');
    }

    public function test_admin_can_grant_expire_and_reactivate_unused_coupon(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create(['role' => User::ROLE_USER]);

        $grant = $this->actingAs($admin)
            ->postJson('/api/admin/coupons', [
                'user_id' => $customer->id,
                'threshold_mmk' => 500000,
                'discount_percent' => 10,
            ])
            ->assertCreated()
            ->assertJsonPath('coupon.user.id', $customer->id)
            ->assertJsonPath('coupon.threshold_mmk', 500000)
            ->assertJsonPath('coupon.status', 'available');

        $couponId = (int) $grant->json('coupon.id');
        $this->assertStringStartsWith('ADMIN10-'.$customer->id.'-', (string) $grant->json('coupon.code'));

        $this->actingAs($admin)
            ->patchJson('/api/admin/coupons/'.$couponId.'/expire')
            ->assertOk()
            ->assertJsonPath('coupon.status', 'expired');

        $this->actingAs($admin)
            ->patchJson('/api/admin/coupons/'.$couponId.'/reactivate')
            ->assertOk()
            ->assertJsonPath('coupon.status', 'available')
            ->assertJsonPath('coupon.expires_at', null);

        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'coupon.grant',
            'target_type' => 'coupon',
            'target_id' => $couponId,
        ]);
        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'coupon.expire',
            'target_type' => 'coupon',
            'target_id' => $couponId,
        ]);
        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'coupon.reactivate',
            'target_type' => 'coupon',
            'target_id' => $couponId,
        ]);

        $this->assertSame(3, AdminActivityLog::query()->where('target_id', $couponId)->count());
    }

    public function test_admin_cannot_reuse_tier_or_modify_used_coupon(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $customer = User::factory()->create(['role' => User::ROLE_USER]);
        $order = Order::query()->create([
            'user_id' => $customer->id,
            'total_amount' => 10,
            'total_amount_mmk' => 50000,
            'status' => Order::STATUS_PAID,
        ]);
        $usedCoupon = Coupon::query()->create([
            'user_id' => $customer->id,
            'code' => 'USED-'.$customer->id,
            'discount_percent' => 10,
            'threshold_mmk' => 500000,
            'used_at' => now(),
            'used_order_id' => $order->id,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/coupons', [
                'user_id' => $customer->id,
                'threshold_mmk' => 500000,
                'discount_percent' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This user already has a coupon for that reward tier.');

        $this->actingAs($admin)
            ->patchJson('/api/admin/coupons/'.$usedCoupon->id.'/expire')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Used coupons cannot be expired manually.');

        $this->actingAs($admin)
            ->patchJson('/api/admin/coupons/'.$usedCoupon->id.'/reactivate')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Used coupons cannot be reactivated.');
    }
}
