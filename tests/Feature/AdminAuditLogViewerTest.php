<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuditLogViewerTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_audit_log_routes_require_admin_access(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        $log = AdminActivityLog::query()->create([
            'actor_id' => $user->id,
            'action' => 'product.update',
            'target_type' => 'product',
            'target_id' => 10,
        ]);

        $this->getJson('/api/admin/audit-logs')->assertUnauthorized();
        $this->getJson('/api/admin/audit-logs/'.$log->id)->assertUnauthorized();

        $this->actingAs($user)->getJson('/api/admin/audit-logs')->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/audit-logs/'.$log->id)->assertForbidden();
    }

    public function test_admin_can_filter_search_and_view_audit_logs(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN, 'username' => 'admin-one']);
        $otherAdmin = User::factory()->create(['role' => User::ROLE_ADMIN, 'username' => 'admin-two']);

        $productLog = AdminActivityLog::query()->create([
            'actor_id' => $admin->id,
            'action' => 'product.update',
            'target_type' => 'product',
            'target_id' => 10,
            'before_state' => ['name' => 'Old shirt'],
            'after_state' => ['name' => 'New shirt'],
            'meta' => ['ip' => '127.0.0.1'],
        ]);

        AdminActivityLog::query()->create([
            'actor_id' => $otherAdmin->id,
            'action' => 'user.role_update',
            'target_type' => 'user',
            'target_id' => 20,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/audit-logs?action=product.update&target_type=product&q=shirt')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('logs.0.id', $productLog->id)
            ->assertJsonPath('logs.0.actor.username', 'admin-one')
            ->assertJsonPath('options.actions.0', 'product.update');

        $this->actingAs($admin)
            ->getJson('/api/admin/audit-logs/'.$productLog->id)
            ->assertOk()
            ->assertJsonPath('log.before_state.name', 'Old shirt')
            ->assertJsonPath('log.after_state.name', 'New shirt')
            ->assertJsonPath('log.meta.ip', '127.0.0.1');
    }
}
