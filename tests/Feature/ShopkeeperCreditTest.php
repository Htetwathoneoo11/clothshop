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

class ShopkeeperCreditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['commerce.shopkeeper_credit_threshold' => 10_000]);
    }

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

    public function test_apply_rejects_below_threshold_with_remaining(): void
    {
        $user = User::factory()->create(['credit_score' => 100]);

        $this->actingAs($user)
            ->postJson('/api/shopkeeper/apply')
            ->assertStatus(422)
            ->assertJsonPath('eligible', false)
            ->assertJsonPath('remaining_credit', 9900);
    }

    public function test_apply_upgrades_role_when_eligible(): void
    {
        $user = User::factory()->create(['credit_score' => 10_000]);

        $this->actingAs($user)
            ->postJson('/api/shopkeeper/apply')
            ->assertOk()
            ->assertJsonPath('eligible', true)
            ->assertJsonPath('user.role', User::ROLE_SHOPKEEPER);

        $this->assertTrue($user->fresh()->isShopkeeper());
    }

    public function test_apply_noop_when_already_shopkeeper(): void
    {
        $user = User::factory()->create([
            'credit_score' => 50_000,
            'role' => User::ROLE_SHOPKEEPER,
        ]);

        $this->actingAs($user)
            ->postJson('/api/shopkeeper/apply')
            ->assertOk()
            ->assertJsonPath('eligible', false)
            ->assertJsonPath('remaining_credit', 0);

        $this->assertSame(User::ROLE_SHOPKEEPER, (int) $user->fresh()->role);
    }

    public function test_me_includes_credit_score_and_shopkeeper_eligibility(): void
    {
        $user = User::factory()->create(['credit_score' => 500]);

        $this->actingAs($user)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.credit_score', 500)
            ->assertJsonPath('user.is_shopkeeper', false)
            ->assertJsonPath('user.shopkeeper_eligibility.threshold', 10_000)
            ->assertJsonPath('user.shopkeeper_eligibility.eligible', false)
            ->assertJsonPath('user.shopkeeper_eligibility.remaining_credit', 9500);
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
