<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\EmailVerificationCode;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Support\MmkMoney;
use InvalidArgumentException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ApiCommerceTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_and_me_flow_returns_authenticated_user(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/auth/register', [
            'username' => 'shopper1',
            'email' => 'shopper1@example.com',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', 'shopper1@example.com');

        $this->assertGuest();
        $user = User::query()->where('email', 'shopper1@example.com')->firstOrFail();
        EmailVerificationCode::query()->where('user_id', $user->id)->update([
            'code_hash' => Hash::make('123456'),
        ]);

        $this->postJson('/api/auth/verify-email-code', [
            'email' => 'shopper1@example.com',
            'code' => '123456',
        ])->assertOk()
            ->assertJsonPath('user.username', 'shopper1')
            ->assertJsonPath('user.email', 'shopper1@example.com');

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
            'unit_price_mmk' => MmkMoney::usdDecimalToMmk('19.99'),
        ]);

        $response = $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload());

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

    public function test_checkout_requires_verified_email(): void
    {
        $user = User::factory()->unverified()->create();
        $variant = $this->createVariant(stock: 5, price: '19.99');
        $cart = Cart::create(['user_id' => $user->id]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => '19.99',
            'unit_price_mmk' => MmkMoney::usdDecimalToMmk('19.99'),
        ]);

        $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload())
            ->assertStatus(403)
            ->assertJsonPath('message', 'Please verify your email before checkout.');

        $this->assertDatabaseCount('orders', 0);
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
            'unit_price_mmk' => MmkMoney::usdDecimalToMmk('19.99'),
        ]);

        $response = $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload());
        $response->assertOk()->assertJsonPath('message', 'Checkout successful.')->assertJsonPath('currency_code', 'MMK');

        $order = Order::query()->where('user_id', $user->id)->latest('id')->first();
        $this->assertNotNull($order);

        $unitMmk = MmkMoney::usdDecimalToMmk('19.99');
        $expectedTotalMmk = MmkMoney::lineTotalMmk(2, $unitMmk);

        $this->assertSame($expectedTotalMmk, (int) $order->total_amount_mmk);
        $this->assertSame('39.98', (string) $order->total_amount);
        $this->assertSame(Order::STATUS_PENDING, $order->status);
        $this->assertNull($order->credit_awarded_at);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price_mmk' => $unitMmk,
            'line_total_mmk' => $expectedTotalMmk,
        ]);
        $this->assertDatabaseMissing('cart_items', [
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
        ]);
        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'stock' => 3,
        ]);

        $ordersResponse = $this->actingAs($user)->getJson('/api/orders')->assertOk();
        $ordersResponse->assertJsonPath('orders.0.currency_code', 'MMK');
        $ordersResponse->assertJsonPath('orders.0.total_amount_mmk', $expectedTotalMmk);
        $ordersResponse->assertJsonPath('orders.0.status', Order::STATUS_PENDING);
        $ordersResponse->assertJsonPath('orders.0.credit_earned_mmk', 0);
        $line = $ordersResponse->json('orders.0.items.0');
        $this->assertSame($line['quantity'] * $line['unit_price_mmk'], $line['line_total_mmk']);
    }

    public function test_user_can_apply_threshold_coupon_to_cart_and_checkout_with_discount(): void
    {
        $user = User::factory()->create(['credit_score' => Coupon::CREDIT_THRESHOLD_MMK]);
        $variant = $this->createVariant(stock: 5, price: '100.00');
        $cart = Cart::create(['user_id' => $user->id]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => '100.00',
            'unit_price_mmk' => MmkMoney::usdDecimalToMmk('100.00'),
        ]);

        $cartResponse = $this->actingAs($user)->getJson('/api/cart')
            ->assertOk()
            ->assertJsonPath('available_coupons.0.code', 'LOYAL10-'.$user->id)
            ->assertJsonPath('available_coupons.0.discount_percent', 10);

        $code = $cartResponse->json('available_coupons.0.code');

        $this->actingAs($user)->postJson('/api/cart/coupon', [
            'code' => $code,
        ])->assertOk()
            ->assertJsonPath('message', 'Coupon applied.');

        $subtotalMmk = MmkMoney::usdDecimalToMmk('100.00');
        $discountMmk = intdiv($subtotalMmk * 10, 100);

        $this->actingAs($user)->getJson('/api/cart')
            ->assertOk()
            ->assertJsonPath('applied_coupon.code', $code)
            ->assertJsonPath('discount_mmk', $discountMmk)
            ->assertJsonPath('total_mmk', $subtotalMmk - $discountMmk);

        $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload())
            ->assertOk();

        $order = Order::query()->where('user_id', $user->id)->latest('id')->firstOrFail();
        $this->assertSame($subtotalMmk - $discountMmk, (int) $order->total_amount_mmk);
        $this->assertSame($discountMmk, (int) $order->discount_mmk);
        $this->assertSame($code, $order->coupon_code);
        $this->assertDatabaseHas('coupons', [
            'code' => $code,
            'used_order_id' => $order->id,
        ]);
        $this->assertNull($cart->fresh()->coupon_id);
    }

    public function test_checkout_keeps_legacy_decimal_order_item_totals_consistent(): void
    {
        $user = User::factory()->create();
        $variant = $this->createVariant(stock: 5, price: '28.00');
        $cart = Cart::create(['user_id' => $user->id]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 2,
            'unit_price' => '28.00',
            'unit_price_mmk' => 125979,
        ]);

        $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload([
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
        ]))->assertOk();

        $order = Order::query()->where('user_id', $user->id)->latest('id')->firstOrFail();
        $item = $order->items()->firstOrFail();

        $this->assertSame('28.00', (string) $item->unit_price);
        $this->assertSame('56.00', (string) $item->line_total);
        $this->assertSame(125979, (int) $item->unit_price_mmk);
        $this->assertSame(251958, (int) $item->line_total_mmk);
    }

    public function test_stripe_checkout_order_creates_sandbox_session(): void
    {
        config([
            'app.url' => 'http://localhost',
            'services.stripe.secret' => 'sk_test_example',
        ]);
        Http::fake([
            'https://api.stripe.com/v1/checkout/sessions' => Http::response([
                'id' => 'cs_test_123',
                'url' => 'https://checkout.stripe.com/c/pay/cs_test_123',
            ]),
        ]);

        $user = User::factory()->create();
        $variant = $this->createVariant(stock: 5, price: '19.99');
        $cart = Cart::create(['user_id' => $user->id]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_variant_id' => $variant->id,
            'quantity' => 1,
            'unit_price' => '19.99',
            'unit_price_mmk' => MmkMoney::usdDecimalToMmk('19.99'),
        ]);

        $checkout = $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload([
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
        ]));

        $checkout->assertOk()
            ->assertJsonPath('payment_required', true)
            ->assertJsonPath('payment_method', Order::PAYMENT_STRIPE_CHECKOUT);

        $orderId = $checkout->json('order_id');

        $this->actingAs($user)->postJson("/api/orders/{$orderId}/stripe-checkout")
            ->assertOk()
            ->assertJsonPath('session_id', 'cs_test_123')
            ->assertJsonPath('checkout_url', 'https://checkout.stripe.com/c/pay/cs_test_123');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => Order::STATUS_PENDING,
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
            'stripe_checkout_session_id' => 'cs_test_123',
        ]);
        $this->assertSame(0, (int) $user->fresh()->credit_score);
    }

    public function test_stripe_confirm_marks_order_paid_and_awards_credit_once(): void
    {
        config(['services.stripe.secret' => 'sk_test_example']);
        Http::fake([
            'https://api.stripe.com/v1/checkout/sessions/cs_test_paid' => Http::response([
                'id' => 'cs_test_paid',
                'payment_status' => 'paid',
                'status' => 'complete',
                'payment_intent' => 'pi_test_paid',
                'metadata' => ['order_id' => '1'],
            ]),
        ]);

        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'total_amount' => '39.98',
            'total_amount_mmk' => 83958,
            'status' => Order::STATUS_PENDING,
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
            'stripe_checkout_session_id' => 'cs_test_paid',
        ]);

        $this->actingAs($user)->postJson('/api/orders/stripe-confirm', [
            'session_id' => 'cs_test_paid',
        ])->assertOk()
            ->assertJsonPath('order.status', Order::STATUS_PAID)
            ->assertJsonPath('order.credit_earned_mmk', 83958)
            ->assertJsonPath('order.payment.stripe_checkout_session_id', 'cs_test_paid');

        $this->assertSame(83958, (int) $user->fresh()->credit_score);
        $this->assertSame(Order::STATUS_PAID, $order->fresh()->status);
        $this->assertSame('pi_test_paid', $order->fresh()->stripe_payment_intent_id);

        $this->actingAs($user)->postJson('/api/orders/stripe-confirm', [
            'session_id' => 'cs_test_paid',
        ])->assertOk();

        $this->assertSame(83958, (int) $user->fresh()->credit_score);
    }

    public function test_stripe_webhook_marks_order_paid_with_valid_signature(): void
    {
        config(['services.stripe.webhook_secret' => 'whsec_test']);

        $user = User::factory()->create();
        $order = Order::create([
            'user_id' => $user->id,
            'total_amount' => '12.00',
            'total_amount_mmk' => 25200,
            'status' => Order::STATUS_PENDING,
            'payment_method' => Order::PAYMENT_STRIPE_CHECKOUT,
            'stripe_checkout_session_id' => 'cs_test_webhook',
        ]);
        $payload = json_encode([
            'type' => 'checkout.session.completed',
            'data' => [
                'object' => [
                    'id' => 'cs_test_webhook',
                    'payment_status' => 'paid',
                    'status' => 'complete',
                    'payment_intent' => 'pi_test_webhook',
                    'metadata' => ['order_id' => (string) $order->id],
                ],
            ],
        ]);
        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$payload, 'whsec_test');

        $this->postJson('/api/stripe/webhook', json_decode($payload, true), [
            'Stripe-Signature' => "t={$timestamp},v1={$signature}",
        ])->assertOk()
            ->assertJsonPath('received', true);

        $this->assertSame(Order::STATUS_PAID, $order->fresh()->status);
        $this->assertSame(25200, (int) $user->fresh()->credit_score);
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
            'price_mmk' => MmkMoney::usdDecimalToMmk($price),
            'stock' => $stock,
            'sku' => 'TEST-' . $stock . '-' . uniqid(),
        ]);
    }

    private function checkoutPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Test Customer',
            'phone_number' => '5551234567',
            'delivery_date' => now()->addDay()->toDateString(),
            'delivery_time' => '13:00',
            'building_or_flat' => 'A-101',
            'street_or_road' => 'Main Street',
            'township' => 'Central',
            'city' => 'Springfield',
            'payment_method' => 'cash_on_delivery',
        ], $overrides);
    }
}
