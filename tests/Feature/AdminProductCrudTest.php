<?php

namespace Tests\Feature;

use App\Models\AdminActivityLog;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminProductCrudTest extends TestCase
{
    use RefreshDatabase;

    /** @var string 1x1 transparent GIF (no GD required) */
    private const FAKE_IMAGE_BYTES = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    private function fakeImageUpload(string $filename = 'p.gif'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($filename, base64_decode(self::FAKE_IMAGE_BYTES, true));
    }

    public function test_admin_product_routes_require_authentication(): void
    {
        $product = Product::query()->create([
            'name' => 'X',
            'category' => 'General',
            'is_active' => true,
        ]);
        $variant = $product->variants()->create([
            'color' => 'Black',
            'size' => 'M',
            'price' => 10,
            'price_mmk' => 21000,
            'stock' => 2,
            'sku' => 'AUTH-1',
        ]);

        $this->getJson('/api/admin/products')->assertUnauthorized();
        $this->postJson('/api/admin/products', [])->assertUnauthorized();
        $this->putJson('/api/admin/products/'.$product->id, ['name' => 'Y'])->assertUnauthorized();
        $this->deleteJson('/api/admin/products/'.$product->id)->assertUnauthorized();
        $this->postJson('/api/admin/products/'.$product->id.'/variants', [])->assertUnauthorized();
        $this->putJson('/api/admin/product-variants/'.$variant->id, [])->assertUnauthorized();
        $this->deleteJson('/api/admin/product-variants/'.$variant->id)->assertUnauthorized();
    }

    public function test_non_admin_cannot_manage_products(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        $product = Product::query()->create([
            'name' => 'X',
            'category' => 'General',
            'is_active' => true,
        ]);
        $variant = $product->variants()->create([
            'color' => 'Black',
            'size' => 'M',
            'price' => 10,
            'price_mmk' => 21000,
            'stock' => 2,
            'sku' => 'FORB-1',
        ]);

        $this->actingAs($user)->getJson('/api/admin/products')->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/products', [])->assertForbidden();
        $this->actingAs($user)->putJson('/api/admin/products/'.$product->id, ['name' => 'Y'])->assertForbidden();
        $this->actingAs($user)->deleteJson('/api/admin/products/'.$product->id)->assertForbidden();
        $this->actingAs($user)->postJson('/api/admin/products/'.$product->id.'/variants', [])->assertForbidden();
        $this->actingAs($user)->putJson('/api/admin/product-variants/'.$variant->id, [])->assertForbidden();
        $this->actingAs($user)->deleteJson('/api/admin/product-variants/'.$variant->id)->assertForbidden();
    }

    public function test_admin_can_create_update_and_delete_product(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $create = $this->actingAs($admin)->postJson('/api/admin/products', [
            'name' => 'New Product',
            'category' => 'Topwear',
            'brand' => 'Brand A',
            'description' => 'Desc',
            'image_url' => 'https://example.com/a.jpg',
            'is_active' => true,
            'variant' => [
                'color' => 'Black',
                'size' => 'M',
                'price_mmk' => 40000,
                'stock' => 5,
            ],
        ]);

        $create->assertCreated()
            ->assertJsonPath('product.name', 'New Product')
            ->assertJsonPath('product.variants.0.price_mmk', 40000);

        $productId = $create->json('product.id');

        $this->actingAs($admin)->putJson('/api/admin/products/'.$productId, [
            'name' => 'Updated Product',
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('product.name', 'Updated Product')
            ->assertJsonPath('product.is_active', false);

        $this->assertDatabaseHas('products', [
            'id' => $productId,
            'name' => 'Updated Product',
            'is_active' => 0,
        ]);

        $this->actingAs($admin)->deleteJson('/api/admin/products/'.$productId)
            ->assertOk()
            ->assertJsonPath('message', 'Product deleted successfully.');

        $this->assertDatabaseMissing('products', ['id' => $productId]);
    }

    public function test_admin_can_crud_variants_and_cannot_delete_last_variant(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $create = $this->actingAs($admin)->postJson('/api/admin/products', [
            'name' => 'Variant Product',
            'category' => 'Topwear',
            'is_active' => true,
            'variant' => [
                'color' => 'Black',
                'size' => 'M',
                'price_mmk' => 40000,
                'stock' => 5,
                'sku' => 'VAR-INIT',
            ],
        ])->assertCreated();

        $productId = $create->json('product.id');
        $initialVariantId = $create->json('product.variants.0.id');

        $add = $this->actingAs($admin)->postJson('/api/admin/products/'.$productId.'/variants', [
            'color' => 'White',
            'size' => 'L',
            'price_mmk' => 42000,
            'stock' => 3,
            'sku' => 'VAR-2',
        ])->assertCreated();

        $variantId = $add->json('variant.id');

        $this->actingAs($admin)->putJson('/api/admin/product-variants/'.$variantId, [
            'stock' => 9,
            'price_mmk' => 43000,
        ])
            ->assertOk()
            ->assertJsonPath('variant.stock', 9)
            ->assertJsonPath('variant.price_mmk', 43000);

        $this->actingAs($admin)->deleteJson('/api/admin/product-variants/'.$variantId)
            ->assertOk()
            ->assertJsonPath('message', 'Variant deleted successfully.');

        $this->assertDatabaseMissing('product_variants', ['id' => $variantId]);

        $this->actingAs($admin)->deleteJson('/api/admin/product-variants/'.$initialVariantId)
            ->assertStatus(422)
            ->assertJsonPath('message', 'A product must keep at least one variant.');
    }

    public function test_admin_can_upload_replace_and_remove_product_image(): void
    {
        Storage::fake('public');
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $create = $this->actingAs($admin)
            ->post('/api/admin/products', [
                'name' => 'Image Product',
                'category' => 'General',
                'variant' => [
                    'color' => 'Black',
                    'size' => 'M',
                    'price_mmk' => 1000,
                    'stock' => 2,
                ],
                'image' => $this->fakeImageUpload('p1.gif'),
            ]);

        $create->assertCreated();
        $productId = $create->json('product.id');
        $firstUrl = (string) $create->json('product.image_url');
        $firstPath = ltrim((string) parse_url($firstUrl, PHP_URL_PATH), '/');
        $firstPath = preg_replace('/^storage\\//', '', $firstPath) ?? '';
        Storage::disk('public')->assertExists($firstPath);

        $update = $this->actingAs($admin)
            ->post('/api/admin/products/'.$productId.'?_method=PUT', [
                'name' => 'Image Product',
                'image' => $this->fakeImageUpload('p2.gif'),
            ]);

        $update->assertOk();
        $secondUrl = (string) $update->json('product.image_url');
        $secondPath = ltrim((string) parse_url($secondUrl, PHP_URL_PATH), '/');
        $secondPath = preg_replace('/^storage\\//', '', $secondPath) ?? '';
        Storage::disk('public')->assertExists($secondPath);
        Storage::disk('public')->assertMissing($firstPath);

        $remove = $this->actingAs($admin)
            ->post('/api/admin/products/'.$productId.'?_method=PUT', [
                'name' => 'Image Product',
                'remove_image' => 1,
            ]);

        $remove->assertOk()
            ->assertJsonPath('product.image_url', null);
        Storage::disk('public')->assertMissing($secondPath);
    }

    public function test_admin_product_index_supports_query_filters_sort_and_pagination(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $zeta = Product::query()->create([
            'name' => 'Zeta Jacket',
            'category' => 'Outerwear',
            'brand' => 'Brand Z',
            'description' => 'Warm jacket',
            'is_active' => true,
        ]);
        $zeta->variants()->create([
            'color' => 'Black',
            'size' => 'M',
            'price' => 10,
            'price_mmk' => 50000,
            'stock' => 3,
            'sku' => 'ZETA-1',
        ]);

        $alpha = Product::query()->create([
            'name' => 'Alpha Tee',
            'category' => 'Topwear',
            'brand' => 'Brand A',
            'description' => 'Basic tee',
            'is_active' => true,
        ]);
        $alpha->variants()->create([
            'color' => 'White',
            'size' => 'L',
            'price' => 10,
            'price_mmk' => 20000,
            'stock' => 5,
            'sku' => 'ALPHA-1',
        ]);

        $hidden = Product::query()->create([
            'name' => 'Hidden Pants',
            'category' => 'Bottomwear',
            'brand' => 'Brand H',
            'description' => 'Not active',
            'is_active' => false,
        ]);
        $hidden->variants()->create([
            'color' => 'Blue',
            'size' => 'S',
            'price' => 10,
            'price_mmk' => 35000,
            'stock' => 4,
            'sku' => 'HIDDEN-1',
        ]);

        $defaultActive = $this->actingAs($admin)->getJson('/api/admin/products')
            ->assertOk();

        $defaultNames = collect($defaultActive->json('products'))->pluck('name');
        $this->assertTrue($defaultNames->contains('Zeta Jacket'));
        $this->assertTrue($defaultNames->contains('Alpha Tee'));
        $this->assertFalse($defaultNames->contains('Hidden Pants'));
        $defaultActive->assertJsonPath('filters.status', 'active');

        $pageOne = $this->actingAs($admin)
            ->getJson('/api/admin/products?status=all&sort=name_asc&per_page=2&page=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('products.0.name', 'Alpha Tee')
            ->assertJsonPath('products.1.name', 'Hidden Pants');

        $pageTwo = $this->actingAs($admin)
            ->getJson('/api/admin/products?status=all&sort=name_asc&per_page=2&page=2')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('products.0.name', 'Zeta Jacket');

        $search = $this->actingAs($admin)
            ->getJson('/api/admin/products?status=all&q=hidden')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('products.0.name', 'Hidden Pants');

        $inactiveOnly = $this->actingAs($admin)
            ->getJson('/api/admin/products?status=inactive')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('products.0.name', 'Hidden Pants');

        $priceSort = $this->actingAs($admin)
            ->getJson('/api/admin/products?status=all&sort=price_desc')
            ->assertOk();

        $priceSorted = collect($priceSort->json('products'))->pluck('name')->values()->all();
        $this->assertSame(['Zeta Jacket', 'Hidden Pants', 'Alpha Tee'], $priceSorted);
    }

    public function test_admin_product_mutations_write_audit_logs(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $created = $this->actingAs($admin)->postJson('/api/admin/products', [
            'name' => 'Audit Product',
            'category' => 'General',
            'is_active' => true,
            'variant' => [
                'color' => 'Black',
                'size' => 'M',
                'price_mmk' => 5000,
                'stock' => 2,
                'sku' => 'AUDIT-V1',
            ],
        ])->assertCreated();

        $productId = (int) $created->json('product.id');
        $variantId = (int) $created->json('product.variants.0.id');

        $this->actingAs($admin)->putJson('/api/admin/products/'.$productId, [
            'name' => 'Audit Product Updated',
        ])->assertOk();

        $this->actingAs($admin)->putJson('/api/admin/product-variants/'.$variantId, [
            'stock' => 7,
        ])->assertOk();

        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'product.create',
            'target_type' => 'product',
            'target_id' => $productId,
        ]);

        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'product.update',
            'target_type' => 'product',
            'target_id' => $productId,
        ]);

        $this->assertDatabaseHas('admin_activity_logs', [
            'actor_id' => $admin->id,
            'action' => 'product.variant.update',
            'target_type' => 'product_variant',
            'target_id' => $variantId,
        ]);

        $this->assertSame(
            3,
            AdminActivityLog::query()
                ->where('actor_id', $admin->id)
                ->whereIn('action', ['product.create', 'product.update', 'product.variant.update'])
                ->count()
        );
    }
}
