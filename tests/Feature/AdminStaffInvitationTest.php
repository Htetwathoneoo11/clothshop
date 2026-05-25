<?php

namespace Tests\Feature;

use App\Models\StaffInvitation;
use App\Models\User;
use App\Notifications\StaffInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AdminStaffInvitationTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_invitations_require_super_admin_permission(): void
    {
        $manager = User::factory()->create(['role' => User::ROLE_MANAGER]);
        $superAdmin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->getJson('/api/admin/staff-invitations')->assertUnauthorized();
        $this->actingAs($manager)->getJson('/api/admin/staff-invitations')->assertForbidden();
        $this->actingAs($superAdmin)->getJson('/api/admin/staff-invitations')->assertOk();
    }

    public function test_super_admin_can_create_cancel_and_accept_staff_invitation(): void
    {
        Notification::fake();
        $superAdmin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $created = $this->actingAs($superAdmin)
            ->postJson('/api/admin/staff-invitations', [
                'username' => 'staff-manager',
                'email' => 'staff-manager@example.test',
                'role' => User::ROLE_MANAGER,
                'expires_in_days' => 5,
            ])
            ->assertCreated()
            ->assertJsonPath('invitation.email', 'staff-manager@example.test')
            ->assertJsonPath('invitation.role', User::ROLE_MANAGER)
            ->assertJsonPath('invitation.status', 'pending')
            ->assertJsonStructure(['invitation' => ['token', 'accept_url']]);

        $token = $created->json('invitation.token');
        $invitationId = (int) $created->json('invitation.id');

        Notification::assertSentOnDemand(StaffInvitationNotification::class, function (StaffInvitationNotification $notification, array $channels, object $notifiable) use ($invitationId) {
            return $notification->invitationId() === $invitationId
                && $channels === ['mail']
                && ($notifiable->routes['mail'] ?? null) === 'staff-manager@example.test';
        });

        Auth::guard('web')->logout();
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/staff-invitations/accept', [
            'token' => $token,
            'password' => 'StaffPass123',
            'password_confirmation' => 'StaffPass123',
        ])
            ->assertCreated()
            ->assertJsonPath('message', 'Staff account created. You are now signed in.')
            ->assertJsonPath('user.username', 'staff-manager')
            ->assertJsonPath('user.role', User::ROLE_MANAGER);

        $user = User::query()->where('email', 'staff-manager@example.test')->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertTrue(Hash::check('StaffPass123', $user->password));
        $this->assertNotNull($user->email_verified_at);
        $this->assertDatabaseHas('staff_invitations', [
            'id' => $invitationId,
            'accepted_user_id' => $user->id,
        ]);

        $cancel = $this->actingAs($superAdmin)
            ->postJson('/api/admin/staff-invitations', [
                'username' => 'staff-support',
                'email' => 'staff-support@example.test',
                'role' => User::ROLE_SUPPORT,
            ])
            ->assertCreated();

        $this->actingAs($superAdmin)
            ->patchJson('/api/admin/staff-invitations/'.$cancel->json('invitation.id').'/cancel')
            ->assertOk()
            ->assertJsonPath('invitation.status', 'cancelled');
    }

    public function test_staff_invitation_accept_rejects_cancelled_or_expired_token(): void
    {
        $superAdmin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $token = 'plain-token';
        $invitation = StaffInvitation::query()->create([
            'username' => 'expired-staff',
            'email' => 'expired-staff@example.test',
            'role' => User::ROLE_SUPPORT,
            'token_hash' => hash('sha256', $token),
            'invited_by' => $superAdmin->id,
            'expires_at' => now()->subDay(),
        ]);

        $this->postJson('/api/staff-invitations/accept', [
            'token' => $token,
            'password' => 'StaffPass123',
            'password_confirmation' => 'StaffPass123',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This staff invitation is invalid or has expired.');

        $this->assertDatabaseMissing('users', [
            'email' => $invitation->email,
        ]);
    }
}
