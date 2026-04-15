<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
        $response = $this->postJson('/api/auth/register', [
            'username' => 'newuser',
            'email' => 'new@site.com',
            'password' => 'AnyPass123',
            'password_confirmation' => 'AnyPass123',
        ]);

        $response->assertCreated()->assertJsonPath('user.username', 'newuser');

        $this->assertDatabaseHas('users', [
            'username' => 'newuser',
            'email' => 'new@site.com',
        ]);
    }

    public function test_register_then_login(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'username' => 'newuser',
            'email' => 'new@site.com',
            'password' => 'AnyPass123',
            'password_confirmation' => 'AnyPass123',
        ]);

        $response->assertCreated();

        $this->postJson('/api/auth/logout')->assertOk();

        $response = $this->postJson('/api/auth/login', [
            'username' => 'newuser',
            'password' => 'AnyPass123',
        ]);

        $response->assertOk()->assertJsonPath('user.username', 'newuser');
    }
}
