<?php

namespace Tests\Feature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use App\Models\User;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function csrfToken(): string
    {
        return 'test_csrf_token';
    }// CSRF token
    private function postWithCsrf(string $routeName, array $data = [])
    {
        $token = $this->csrfToken();

        return $this->withSession(['_token' => $token])->post(route($routeName), array_merge($data, [
            '_token' => $token,
        ]));
    }//PostWithCsrf helper method
    public function test_login_rejects_invalid_username(): void
    {
        $response = $this->postWithCsrf('users.login', [
            'username' => 'no_such_user',
            'password' => 'any',
        ]);

        $response->assertRedirect(route('users.login'));
        $response->assertSessionHas('error', 'Invalid username');
    }//TL-04
    public function test_login_rejects_invalid_password(): void
    {
        $user = User::factory()->create([
            'username' => 'validuser',
            'password' => Hash::make('correctpass'),
        ]);

        $response = $this->postWithCsrf('users.login', [
            'username' => $user->username,
            'password' => 'wrongpass',
        ]);

        $response->assertRedirect(route('users.login'));
        $response->assertSessionHas('error', 'Invalid password');
    }//TL-05
    public function test_login_success(): void
    {
        $user = User::factory()->create([
            'username' => 'validuser',
            'password' => Hash::make('correctpass'),
        ]);

        $response = $this->postWithCsrf('users.login', [
            'username' => $user->username,
            'password' => 'correctpass',
        ]);

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticatedAs($user);
        $response->assertSessionHas('success', 'Logged in successfully');
    }//TL-06
    public function test_login_requires_csrf_token(): void
    {
        $this->withMiddleware(\App\Http\Middleware\VerifyCsrfToken::class);
        $response = $this->post(route('users.login'), [
            'username' => 'any',
            'password' => 'any',
        ]);

        $response->assertStatus(419);
    }//TL-10
    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create([
            'email' => 'existing@site.com',
        ]);

        $response = $this->postWithCsrf('users.register', [
            'username' => 'newuser',
            'email' => 'existing@site.com',
            'password' => 'AnyPass123',
        ]);

        $response->assertSessionHasErrors(['email']);
    }//TR-06
    public function test_register_success(): void
    {
        $response = $this->postWithCsrf('users.register', [
            'username' => 'newuser',
            'email' => 'new@site.com',
            'password' => 'AnyPass123',
        ]);

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHas('success', 'Your account has been created successfully.');

        $this->assertDatabaseHas('users', [
            'username' => 'newuser',
            'email' => 'new@site.com',
        ]);
    }//TR-07
    public function test_register_requires_csrf_token(): void
    {
        $response = $this->post(route('users.register'), [
            'username' => 'newuser',
            'email' => 'new@site.com',
            'password' => 'AnyPass123',
        ]);

        $response->assertStatus(419);
    }//TR-11
    public function test_register_then_login(): void
    {
        $response = $this->postWithCsrf('users.register', [
            'username' => 'newuser',
            'email' => 'new@site.com',
            'password' => 'AnyPass123',
        ]);

        $response->assertRedirect(route('dashboard'));

        $response = $this->postWithCsrf('users.login', [
            'username' => 'newuser',
            'password' => 'AnyPass123',
        ]);

        $response->assertRedirect(route('dashboard'));
        $this->assertAuthenticated();
    }//TR-12
}
