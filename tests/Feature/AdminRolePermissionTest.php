<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminRolePermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_me_exposes_admin_role_permissions(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_MANAGER]);

        $this->actingAs($manager)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.is_admin', true)
            ->assertJsonPath('user.admin_role', 'manager')
            ->assertJsonPath('user.role_label', 'Manager')
            ->assertJsonPath('user.permissions.manage_orders', true)
            ->assertJsonPath('user.permissions.manage_users', false)
            ->assertJsonPath('user.permissions.view_reports', true);
    }

    public function test_admin_sub_roles_are_restricted_by_route_permission(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_MANAGER]);
        $support = User::factory()->create(['role' => User::ROLE_SUPPORT]);
        $inventoryAdmin = User::factory()->create(['role' => User::ROLE_INVENTORY_ADMIN]);

        $this->actingAs($manager)->getJson('/api/admin/reports')->assertOk();
        $this->actingAs($manager)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($manager)->getJson('/api/admin/audit-logs')->assertForbidden();

        $this->actingAs($support)->getJson('/api/admin/orders')->assertOk();
        $this->actingAs($support)->getJson('/api/admin/notifications')->assertOk();
        $this->actingAs($support)->getJson('/api/admin/reports')->assertForbidden();
        $this->actingAs($support)->getJson('/api/admin/products')->assertForbidden();

        $this->actingAs($inventoryAdmin)->getJson('/api/admin/products')->assertOk();
        $this->actingAs($inventoryAdmin)->getJson('/api/admin/inventory-adjustments')->assertOk();
        $this->actingAs($inventoryAdmin)->getJson('/api/admin/orders')->assertForbidden();
        $this->actingAs($inventoryAdmin)->getJson('/api/admin/coupons')->assertForbidden();
    }
}
