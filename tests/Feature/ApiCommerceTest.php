<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use InvalidArgumentException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ApiCommerceTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_and_me_flow_returns_authenticated_user(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'username' => 'shopper1',
            'email' => 'shopper1@example.com',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.username', 'shopper1')
            ->assertJsonPath('user.email', 'shopper1@example.com');

        $this->assertAuthenticated();

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.username', 'shopper1');
    }

    public function test_register_rejects_duplicate_username(): void
    {
        User::factory()->create([
            'username' => 'existing_user',
            'email' => 'existing@example.com',
        ]);

        $response = $this->postJson('/api/auth/register', [
            'username' => 'existing_user',
            'email' => 'new@example.com',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['username']);
    }

    public function test_login_and_logout_flow(): void
    {
        User::factory()->create([
            'username' => 'buyer',
            'email' => 'buyer@example.com',
            'password' => Hash::make('Password123'),
        ]);

        $this->getJson('/api/me')->assertStatus(401);

        $this->postJson('/api/auth/login', [
            'username' => 'buyer',
            'password' => 'Password123',
        ])->assertOk()->assertJsonPath('user.username', 'buyer');

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.username', 'buyer');

        $this->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');
    }

    public function test_checkout_rejects_when_variant_stock_drops_below_cart_quantity(): void
    {
        $user = User::factory()->create();
        $variant = $this->createVariant(stock: 1, price: '19.99');
        $cart = Cart::create(['user_id' => $user->id]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => '19.99',
        ]);

        $response = $this->actingAs($user)->postJson('/api/checkout');

        $response->assertStatus(409);
        $this->assertStringContainsString('Insufficient stock', $response->json('message', ''));
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseHas('cart_items', [
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
        ]);
        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'stock' => 1,
        ]);
    }

    public function test_successful_checkout_creates_order_updates_stock_and_clears_cart(): void
    {
        $user = User::factory()->create();
        $variant = $this->createVariant(stock: 5, price: '19.99');
        $cart = Cart::create(['user_id' => $user->id]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => '19.99',
        ]);

        $response = $this->actingAs($user)->postJson('/api/checkout');
        $response->assertOk()->assertJsonPath('message', 'Checkout successful.');

        $order = Order::query()->where('user_id', $user->id)->latest('id')->first();
        $this->assertNotNull($order);

        $this->assertSame('39.98', (string) $order->total_amount);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => 19.99,
            'line_total' => 39.98,
        ]);
        $this->assertDatabaseMissing('cart_items', [
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
        ]);
        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'stock' => 3,
        ]);
    }

    public function test_order_model_rejects_invalid_status(): void
    {
        $user = User::factory()->create();

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid order status.');

        Order::create([
            'user_id' => $user->id,
            'total_amount' => 10.00,
            'status' => 'unknown',
        ]);
    }

    private function createVariant(int $stock, string $price): ProductVariant
    {
        $product = Product::create([
            'name' => 'Test Tee',
            'category' => 'Topwear',
            'brand' => 'TestBrand',
            'description' => 'Simple test product',
            'is_active' => true,
        ]);

        return ProductVariant::create([
            'product_id' => $product->id,
            'color' => 'Black',
            'size' => 'M',
            'price' => $price,
            'stock' => $stock,
            'sku' => 'TEST-' . $stock . '-' . uniqid(),
        ]);
    }
}
