<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\InventoryAdjustment;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminInventoryManagementTest extends TestCase
{
    use RefreshDatabase;

    private function createVariant(array $variantAttributes = [], array $productAttributes = []): ProductVariant
    {
        $product = Product::query()->create(array_merge([
            'name' => 'Inventory Test Jacket',
            'category' => 'Outerwear',
            'brand' => 'Trail Loom',
            'is_active' => true,
        ], $productAttributes));

        return $product->variants()->create(array_merge([
            'color' => 'Olive',
            'size' => 'M',
            'price' => 25,
            'price_mmk' => 75000,
            'stock' => 8,
            'sku' => 'INV-JACKET-M',
        ], $variantAttributes));
    }

    public function test_admin_inventory_routes_require_admin_access(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        $variant = $this->createVariant();
        $adjustment = InventoryAdjustment::query()->create([
            'product_variant_id' => $variant->id,
            'actor_id' => $user->id,
            'previous_stock' => 8,
            'adjustment' => 2,
            'new_stock' => 10,
            'reason' => 'restock',
        ]);

        $this->getJson('/api/admin/inventory-adjustments')->assertUnauthorized();
        $this->getJson('/api/admin/inventory-variants')->assertUnauthorized();
        $this->getJson('/api/admin/inventory-adjustments/'.$adjustment->id)->assertUnauthorized();
        $this->postJson('/api/admin/inventory-adjustments', [])->assertUnauthorized();

        $this->actingAs($user)->getJson('/api/admin/inventory-adjustments')->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/inventory-variants')->assertForbidden();
        $this->actingAs($user)->getJson('/api/admin/inventory-adjustments/'.$adjustment->id)->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/inventory-adjustments', [
            'product_variant_id' => $variant->id,
            'adjustment' => 1,
            'reason' => 'manual',
        ])->assertForbidden();
    }

    public function test_admin_can_create_stock_adjustments_and_history_entries(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'username' => 'stock-admin',
        ]);
        $variant = $this->createVariant();

        $restock = $this->actingAs($admin)
            ->postJson('/api/admin/inventory-adjustments', [
                'product_variant_id' => $variant->id,
                'adjustment' => 12,
                'reason' => 'restock',
                'note' => 'Supplier delivery batch A',
            ])
            ->assertCreated()
            ->assertJsonPath('adjustment.previous_stock', 8)
            ->assertJsonPath('adjustment.adjustment', 12)
            ->assertJsonPath('adjustment.new_stock', 20)
            ->assertJsonPath('adjustment.reason', 'restock')
            ->assertJsonPath('adjustment.actor.username', 'stock-admin')
            ->assertJsonPath('adjustment.variant.sku', 'INV-JACKET-M');

        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'stock' => 20,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/inventory-adjustments', [
                'product_variant_id' => $variant->id,
                'adjustment' => -5,
                'reason' => 'damage',
                'note' => 'Warehouse water damage',
            ])
            ->assertCreated()
            ->assertJsonPath('adjustment.previous_stock', 20)
            ->assertJsonPath('adjustment.adjustment', -5)
            ->assertJsonPath('adjustment.new_stock', 15)
            ->assertJsonPath('adjustment.variant.stock', 15);

        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'stock' => 15,
        ]);
        $this->assertDatabaseHas('inventory_adjustments', [
            'id' => $restock->json('adjustment.id'),
            'product_variant_id' => $variant->id,
            'adjustment' => 12,
            'new_stock' => 20,
        ]);
        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'inventory.adjust',
            'target_type' => 'product_variant',
            'target_id' => $variant->id,
        ]);
        $this->assertSame(2, AdminActivityLog::query()->where('action', 'inventory.adjust')->count());

        $this->actingAs($admin)
            ->getJson('/api/admin/inventory-adjustments?q=INV-JACKET-M')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('adjustments.0.variant.product.name', 'Inventory Test Jacket');
    }

    public function test_admin_can_search_inventory_variants_for_adjustment_picker(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $jacket = $this->createVariant(['sku' => 'PICK-JACKET', 'stock' => 8]);
        $shirt = $this->createVariant(
            ['sku' => 'PICK-SHIRT', 'stock' => 3, 'color' => 'Navy', 'size' => 'L'],
            ['name' => 'Picker Shirt', 'brand' => 'Needle North', 'category' => 'Topwear']
        );

        $this->actingAs($admin)
            ->getJson('/api/admin/inventory-variants?q=shirt')
            ->assertOk()
            ->assertJsonCount(1, 'variants')
            ->assertJsonPath('variants.0.id', $shirt->id)
            ->assertJsonPath('variants.0.product.name', 'Picker Shirt')
            ->assertJsonPath('variants.0.sku', 'PICK-SHIRT');

        $this->actingAs($admin)
            ->getJson('/api/admin/inventory-variants?q='.$jacket->id)
            ->assertOk()
            ->assertJsonPath('variants.0.id', $jacket->id);
    }

    public function test_admin_cannot_reduce_stock_below_zero(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $variant = $this->createVariant(['stock' => 3]);

        $this->actingAs($admin)
            ->postJson('/api/admin/inventory-adjustments', [
                'product_variant_id' => $variant->id,
                'adjustment' => -4,
                'reason' => 'correction',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Stock adjustment cannot reduce stock below zero.');

        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'stock' => 3,
        ]);
        $this->assertDatabaseCount('inventory_adjustments', 0);
    }

    public function test_admin_can_filter_inventory_history_by_reason_direction_and_search(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $jacket = $this->createVariant(['sku' => 'FILTER-JACKET', 'stock' => 10]);
        $shirt = $this->createVariant(
            ['sku' => 'FILTER-SHIRT', 'stock' => 4, 'color' => 'Navy'],
            ['name' => 'Inventory Test Shirt', 'category' => 'Topwear']
        );

        $this->actingAs($admin)->postJson('/api/admin/inventory-adjustments', [
            'product_variant_id' => $jacket->id,
            'adjustment' => 5,
            'reason' => 'restock',
            'note' => 'Inbound carton',
        ])->assertCreated();

        $this->actingAs($admin)->postJson('/api/admin/inventory-adjustments', [
            'product_variant_id' => $shirt->id,
            'adjustment' => -2,
            'reason' => 'damage',
            'note' => 'Damaged seam',
        ])->assertCreated();

        $this->actingAs($admin)
            ->getJson('/api/admin/inventory-adjustments?reason=damage&direction=decrease&q=shirt')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('adjustments.0.product_variant_id', $shirt->id)
            ->assertJsonPath('adjustments.0.reason', 'damage')
            ->assertJsonPath('adjustments.0.adjustment', -2);

        $this->actingAs($admin)
            ->getJson('/api/admin/inventory-adjustments?variant_id='.$jacket->id.'&direction=increase')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('adjustments.0.product_variant_id', $jacket->id);
    }
}
