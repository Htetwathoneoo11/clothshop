<?php

namespace Tests\Feature;

use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailCodeNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Auth\SessionGuard;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_rejects_invalid_username(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'username' => 'no_such_user',
            'password' => 'any',
        ]);

        $response->assertStatus(401)->assertJsonPath('message', 'Invalid credentials');
    }

    public function test_login_rejects_invalid_password(): void
    {
        $user = User::factory()->create([
            'username' => 'validuser',
            'password' => Hash::make('correctpass'),
        ]);
        $user->forceFill(['remember_token' => null])->save();

        $response = $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'wrongpass',
        ]);

        $response->assertStatus(401)->assertJsonPath('message', 'Invalid credentials');
    }

    public function test_login_success(): void
    {
        $user = User::factory()->create([
            'username' => 'validuser',
            'password' => Hash::make('correctpass'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'correctpass',
        ]);

        $response->assertOk()->assertJsonPath('user.username', $user->username);
        $this->assertAuthenticatedAs($user);
    }

    public function test_login_requires_verified_email(): void
    {
        $user = User::factory()->unverified()->create([
            'username' => 'unverifieduser',
            'email' => 'unverified@example.com',
            'password' => Hash::make('correctpass'),
        ]);

        $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'correctpass',
        ])->assertStatus(403)
            ->assertJsonPath('message', 'Please verify your email before signing in.')
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', 'unverified@example.com');

        $this->assertGuest();
    }

    public function test_login_rejects_miss_case_username(): void
    {
        User::factory()->create([
            'username' => 'CaseUser',
            'email' => 'case@example.com',
            'password' => Hash::make('correctpass'),
        ]);

        $this->postJson('/api/auth/login', [
            'username' => 'caseuser',
            'password' => 'correctpass',
        ])->assertStatus(401)
            ->assertJsonPath('message', 'Invalid credentials');
    }

    public function test_login_rejects_miss_case_email(): void
    {
        User::factory()->create([
            'username' => 'caseuser',
            'email' => 'Case@Example.com',
            'password' => Hash::make('correctpass'),
        ]);

        $this->postJson('/api/auth/login', [
            'username' => 'case@example.com',
            'password' => 'correctpass',
        ])->assertStatus(401)
            ->assertJsonPath('message', 'Invalid credentials');
    }

    public function test_login_without_remember_me_does_not_issue_recaller_cookie(): void
    {
        $user = User::factory()->create([
            'username' => 'validuser',
            'password' => Hash::make('correctpass'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'correctpass',
            'remember' => false,
        ]);

        $response->assertOk();
        $response->assertCookieMissing($this->rememberCookieName());
    }

    public function test_login_with_remember_me_creates_remember_token(): void
    {
        $user = User::factory()->create([
            'username' => 'validuser',
            'password' => Hash::make('correctpass'),
        ]);
        $user->forceFill(['remember_token' => null])->save();

        $response = $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'correctpass',
            'remember' => true,
        ]);

        $response->assertOk();
        $this->assertNotNull($user->fresh()->remember_token);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create([
            'email' => 'existing@site.com',
        ]);

        $response = $this->postJson('/api/auth/register', [
            'username' => 'newuser',
            'email' => 'existing@site.com',
            'password' => 'AnyPass123',
            'password_confirmation' => 'AnyPass123',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_register_success(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/auth/register', [
            'username' => 'newuser',
            'email' => 'new@site.com',
            'password' => 'AnyPass123',
            'password_confirmation' => 'AnyPass123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', 'new@site.com');

        $this->assertGuest();

        $this->assertDatabaseHas('users', [
            'username' => 'newuser',
            'email' => 'new@site.com',
        ]);
        $this->assertDatabaseCount('email_verification_codes', 1);
    }

    public function test_register_sends_email_verification_code_notification(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/auth/register', [
            'username' => 'verifyuser',
            'email' => 'verify@site.com',
            'password' => 'AnyPass123',
            'password_confirmation' => 'AnyPass123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', 'verify@site.com');

        $user = User::query()->where('email', 'verify@site.com')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, VerifyEmailCodeNotification::class, function (VerifyEmailCodeNotification $notification) use ($user) {
            $mail = $notification->toMail($user);
            $code = $mail->viewData['code'] ?? '';

            return $mail->subject === 'Your Clothshop verification code'
                && $mail->view === 'emails.verify-email-code'
                && preg_match('/^\d{6}$/', $code) === 1;
        });
    }

    public function test_email_verification_code_marks_user_verified_and_signs_in(): void
    {
        $user = User::factory()->unverified()->create();

        EmailVerificationCode::create([
            'user_id' => $user->id,
            'email' => $user->email,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/auth/verify-email-code', [
            'email' => $user->email,
            'code' => '123456',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Your email has been verified.')
            ->assertJsonPath('user.has_verified_email', true);

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseMissing('email_verification_codes', [
            'user_id' => $user->id,
        ]);
    }

    public function test_email_verification_code_rejects_wrong_code_and_counts_attempt(): void
    {
        $user = User::factory()->unverified()->create();

        $record = EmailVerificationCode::create([
            'user_id' => $user->id,
            'email' => $user->email,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/auth/verify-email-code', [
            'email' => $user->email,
            'code' => '654321',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This verification code is invalid or has expired.');

        $this->assertSame(1, $record->fresh()->attempts);
        $this->assertNull($user->fresh()->email_verified_at);
        $this->assertGuest();
    }

    public function test_email_verification_code_rejects_expired_code(): void
    {
        $user = User::factory()->unverified()->create();

        EmailVerificationCode::create([
            'user_id' => $user->id,
            'email' => $user->email,
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->subMinute(),
        ]);

        $this->postJson('/api/auth/verify-email-code', [
            'email' => $user->email,
            'code' => '123456',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This verification code is invalid or has expired.');

        $this->assertNull($user->fresh()->email_verified_at);
        $this->assertGuest();
    }

    public function test_resend_email_verification_code_sends_notification_for_unverified_email(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create([
            'email' => 'verify@site.com',
        ]);

        $this->postJson('/api/auth/resend-email-code', [
            'email' => 'verify@site.com',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Verification code sent.');

        Notification::assertSentTo($user, VerifyEmailCodeNotification::class);
        $this->assertDatabaseCount('email_verification_codes', 1);
    }

    public function test_resend_email_verification_code_is_neutral_for_verified_or_missing_email(): void
    {
        Notification::fake();
        User::factory()->create([
            'email' => 'verified@site.com',
        ]);

        $this->postJson('/api/auth/resend-email-code', [
            'email' => 'verified@site.com',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'If an unverified account exists for that email, a new code has been sent.');

        $this->postJson('/api/auth/resend-email-code', [
            'email' => 'missing@site.com',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'If an unverified account exists for that email, a new code has been sent.');

        Notification::assertNothingSent();
    }

    public function test_register_then_login(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/auth/register', [
            'username' => 'newuser',
            'email' => 'new@site.com',
            'password' => 'AnyPass123',
            'password_confirmation' => 'AnyPass123',
        ]);

        $response->assertCreated();

        $user = User::query()->where('email', 'new@site.com')->firstOrFail();
        EmailVerificationCode::query()->where('user_id', $user->id)->update([
            'code_hash' => Hash::make('123456'),
        ]);

        $this->postJson('/api/auth/verify-email-code', [
            'email' => 'new@site.com',
            'code' => '123456',
        ])->assertOk();

        $this->postJson('/api/auth/logout')->assertOk();

        $response = $this->postJson('/api/auth/login', [
            'username' => 'newuser',
            'password' => 'AnyPass123',
        ]);

        $response->assertOk()->assertJsonPath('user.username', 'newuser');
    }

    public function test_forgot_password_sends_reset_link_to_existing_user(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'email' => 'reset-user@example.com',
        ]);

        $response = $this->postJson('/api/auth/forgot-password', [
            'email' => $user->email,
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a reset link has been sent.');

        Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $notification) use ($user) {
            $mail = $notification->toMail($user);
            $data = $mail->viewData;
            $url = $data['resetUrl'] ?? '';

            return $mail->subject === 'Reset your Clothshop password'
                && $mail->view === 'emails.reset-password'
                && str_contains($url, '/clothshop/reset-password')
                && str_contains($url, 'token=')
                && str_contains($url, 'email='.urlencode($user->email));
        });
    }

    public function test_forgot_password_keeps_unknown_email_response_neutral(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/auth/forgot-password', [
            'email' => 'missing@example.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a reset link has been sent.');

        Notification::assertNothingSent();
    }

    public function test_forgot_password_throttled_requests_keep_neutral_response(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'email' => 'reset-user@example.com',
        ]);

        $this->postJson('/api/auth/forgot-password', [
            'email' => $user->email,
        ])->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a reset link has been sent.');

        $this->postJson('/api/auth/forgot-password', [
            'email' => $user->email,
        ])->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a reset link has been sent.');

        Notification::assertSentToTimes($user, ResetPasswordNotification::class, 1);
    }

    public function test_reset_password_updates_password_with_valid_token(): void
    {
        $user = User::factory()->create([
            'username' => 'resetuser',
            'email' => 'reset-user@example.com',
            'password' => Hash::make('OldPass123'),
        ]);
        $token = Password::createToken($user);

        $response = $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ]);

        $response->assertOk()
            ->assertJsonPath('message', 'Your password has been reset. You can now sign in.');

        $this->assertTrue(Hash::check('NewPass123', $user->fresh()->password));

        $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'NewPass123',
        ])->assertOk()->assertJsonPath('user.username', $user->username);
    }

    public function test_user_can_login_with_username_after_password_reset_by_email(): void
    {
        $user = User::factory()->create([
            'username' => 'username_reset_user',
            'email' => 'username-reset@example.com',
            'password' => Hash::make('OldPass123'),
        ]);
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ])->assertOk();

        $this->postJson('/api/auth/login', [
            'username' => $user->username,
            'password' => 'NewPass123',
        ])->assertOk()
            ->assertJsonPath('user.username', $user->username);
    }

    public function test_validate_reset_token_reports_valid_before_use_and_invalid_after_use(): void
    {
        $user = User::factory()->create([
            'email' => 'reset-user@example.com',
            'password' => Hash::make('OldPass123'),
        ]);
        $token = Password::createToken($user);

        $this->postJson('/api/auth/validate-reset-token', [
            'token' => $token,
            'email' => $user->email,
        ])->assertOk()
            ->assertJsonPath('valid', true)
            ->assertJsonPath('message', 'This reset link is ready to use.');

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ])->assertOk();

        $this->postJson('/api/auth/validate-reset-token', [
            'token' => $token,
            'email' => $user->email,
        ])->assertStatus(422)
            ->assertJsonPath('valid', false)
            ->assertJsonPath('message', 'This reset link has already been used or has expired. Please request a new one.');
    }

    public function test_reset_password_rejects_invalid_token(): void
    {
        $user = User::factory()->create([
            'email' => 'reset-user@example.com',
            'password' => Hash::make('OldPass123'),
        ]);

        $response = $this->postJson('/api/auth/reset-password', [
            'token' => 'invalid-token',
            'email' => $user->email,
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'This password reset link is invalid or has expired.');

        $this->assertTrue(Hash::check('OldPass123', $user->fresh()->password));
    }

    private function rememberCookieName(): string
    {
        return 'remember_web_'.sha1(SessionGuard::class);
    }
}
