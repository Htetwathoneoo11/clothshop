<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CreditScoreService;
use App\Support\MmkMoney;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreditScoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_awards_credit_equal_to_total_amount_mmk(): void
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

        $expected = MmkMoney::lineTotalMmk(2, MmkMoney::usdDecimalToMmk('19.99'));

        $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload())->assertOk();

        $this->assertSame($expected, (int) $user->fresh()->credit_score);

        $order = Order::query()->where('user_id', $user->id)->first();
        $this->assertNotNull($order->credit_awarded_at);
    }

    public function test_credit_is_not_double_awarded_for_same_order(): void
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

        $this->actingAs($user)->postJson('/api/checkout', $this->checkoutPayload())->assertOk();

        $score = (int) $user->fresh()->credit_score;
        $order = Order::query()->where('user_id', $user->id)->first();
        $this->assertNotNull($order);

        app(CreditScoreService::class)->awardForPaidOrder($order->fresh());

        $this->assertSame($score, (int) $user->fresh()->credit_score);
    }

    public function test_me_includes_credit_score_and_is_admin(): void
    {
        $user = User::factory()->create(['credit_score' => 500, 'role' => User::ROLE_USER]);

        $this->actingAs($user)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.credit_score', 500)
            ->assertJsonPath('user.role', User::ROLE_USER)
            ->assertJsonPath('user.is_admin', false);
    }

    public function test_me_is_admin_true_for_admin_role(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.is_admin', true)
            ->assertJsonPath('user.role', User::ROLE_ADMIN);
    }

    public function test_removed_apply_route_returns_not_found(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/shopkeeper/apply')
            ->assertNotFound();
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
            'sku' => 'TEST-'.$stock.'-'.uniqid(),
        ]);
    }

    private function checkoutPayload(): array
    {
        return [
            'name' => 'Test Customer',
            'phone_number' => '5551234567',
            'delivery_date' => now()->addDay()->toDateString(),
            'delivery_time' => '13:00',
            'building_or_flat' => 'A-101',
            'street_or_road' => 'Main Street',
            'township' => 'Central',
            'city' => 'Springfield',
            'payment_method' => 'cash_on_delivery',
        ];
    }
}
