<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminPurchaseRestrictionTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_use_cart_endpoints(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $product = Product::query()->create([
            'name' => 'Preview Product',
            'category' => 'General',
            'is_active' => true,
        ]);
        $variant = $product->variants()->create([
            'color' => 'Black',
            'size' => 'M',
            'price' => 10.00,
            'price_mmk' => 21000,
            'stock' => 5,
            'sku' => 'PREVIEW-1',
        ]);

        $this->actingAs($admin)->getJson('/api/cart')
            ->assertForbidden()
            ->assertJsonPath('message', 'Admins cannot use cart or checkout.');

        $this->actingAs($admin)->postJson('/api/cart', [
            'variant_id' => $variant->id,
            'quantity' => 1,
        ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Admins cannot use cart or checkout.');
    }

    public function test_admin_cannot_checkout(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)->postJson('/api/checkout', [
            'name' => 'Admin User',
            'phone_number' => '09123456789',
            'delivery_date' => now()->toDateString(),
            'delivery_time' => '12:00',
            'building_or_flat' => 'B-2',
            'street_or_road' => 'Main Road',
            'township' => 'Township',
            'city' => 'City',
            'payment_method' => 'cash_on_delivery',
        ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Admins cannot use cart or checkout.');
    }
}

