<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\CartItem;
use App\Models\OrderItem;
use App\Support\AdminAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    private const ALLOWED_CATEGORIES = [
        'General',
        'Topwear',
        'Bottomwear',
        'Outerwear',
        'Dresses',
        'Footwear',
        'Accessories',
    ];

    private const ALLOWED_SIZES = [
        'XS',
        'S',
        'M',
        'L',
        'XL',
        'XXL',
        '30',
        '32',
        '34',
        '36',
        '38',
        '40',
        '41',
        '42',
        '43',
        '44',
    ];

    public function index(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $category = trim((string) $request->query('category', ''));
        $sort = trim((string) $request->query('sort', ''));

        $products = Product::query()
            ->with(['variants' => fn ($query) => $query->orderBy('color')->orderBy('size')])
            ->withMin(['variants as variants_min_price_mmk' => function ($q) {
                $q->where('stock', '>', 0);
            }], 'price_mmk')
            ->where('is_active', true)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('name', 'like', '%' . $search . '%')
                        ->orWhere('brand', 'like', '%' . $search . '%')
                        ->orWhere('description', 'like', '%' . $search . '%');
                });
            })
            ->when($category !== '', fn ($query) => $query->where('category', $category))
            ->when($sort === 'price_asc', fn ($query) => $query->orderBy('variants_min_price_mmk')->orderBy('name'))
            ->when($sort === 'price_desc', fn ($query) => $query->orderByDesc('variants_min_price_mmk')->orderBy('name'))
            ->when(! in_array($sort, ['price_asc', 'price_desc'], true), fn ($query) => $query->orderBy('name'))
            ->get();

        $categories = Product::query()
            ->where('is_active', true)
            ->whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category');

        return response()->json([
            'products' => $products,
            'categories' => $categories,
        ]);
    }//index
    public function show(Product $product)
    {
        if (! $product->is_active) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        $product->load(['variants' => fn ($query) => $query->orderBy('color')->orderBy('size')]);

        return response()->json([
            'product' => $product,
        ]);
    }//show

    public function adminIndex(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', 'active'));
        $sort = trim((string) $request->query('sort', 'newest'));
        $perPage = max(1, min(30, (int) $request->query('per_page', 9)));

        $products = Product::query()
            ->with(['variants' => fn ($query) => $query->orderBy('color')->orderBy('size')])
            ->withMin('variants as variants_min_price_mmk', 'price_mmk')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('name', 'like', '%' . $search . '%')
                        ->orWhere('brand', 'like', '%' . $search . '%')
                        ->orWhere('category', 'like', '%' . $search . '%')
                        ->orWhere('description', 'like', '%' . $search . '%');
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('is_active', true))
            ->when($status === 'inactive', fn ($query) => $query->where('is_active', false));

        $this->applyAdminSort($products, $sort);

        $paginated = $products->paginate($perPage)->withQueryString();

        return response()->json([
            'products' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'filters' => [
                'q' => $search,
                'status' => $status,
                'sort' => $sort,
            ],
        ]);
    }

    public function adminShow(Product $product)
    {
        $product->load(['variants' => fn ($query) => $query->orderBy('color')->orderBy('size')]);

        return response()->json([
            'product' => $product,
        ]);
    }

    public function adminStore(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120', Rule::in(self::ALLOWED_CATEGORIES)],
            'brand' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'url', 'max:2048'],
            'image' => ['nullable', 'image', 'max:5120'],
            'is_active' => ['nullable', 'boolean'],
            'variant' => ['required', 'array'],
            'variant.color' => ['required', 'string', 'max:120'],
            'variant.size' => ['required', 'string', 'max:120', Rule::in(self::ALLOWED_SIZES)],
            'variant.price_mmk' => ['required', 'integer', 'min:0'],
            'variant.stock' => ['required', 'integer', 'min:0'],
            'variant.sku' => ['nullable', 'string', 'max:120', 'unique:product_variants,sku'],
        ]);

        $storedImageUrl = null;
        if ($request->hasFile('image')) {
            $storedImageUrl = $this->storeProductImage($request->file('image'));
        }

        $product = DB::transaction(function () use ($validated, $storedImageUrl) {
            $product = Product::query()->create([
                'name' => $validated['name'],
                'category' => $validated['category'] ?? 'General',
                'brand' => $validated['brand'] ?? null,
                'description' => $validated['description'] ?? null,
                'image_url' => $storedImageUrl ?? ($validated['image_url'] ?? null),
                'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : true,
            ]);

            $variant = $validated['variant'];
            $product->variants()->create([
                'color' => $variant['color'],
                'size' => $variant['size'],
                'price_mmk' => (int) $variant['price_mmk'],
                'price' => $this->toUsdDecimal((int) $variant['price_mmk']),
                'stock' => (int) $variant['stock'],
                'sku' => $variant['sku'] ?? $this->generateSku($product, $variant['color'], $variant['size']),
            ]);

            return $product;
        });

        $created = $product->fresh(['variants']);

        AdminAudit::record(
            $request,
            'product.create',
            'product',
            $created->id,
            null,
            $this->productSnapshot($created)
        );

        return response()->json([
            'product' => $created,
        ], 201);
    }

    public function adminUpdate(Request $request, Product $product)
    {
        $before = $this->productSnapshot($product->load(['variants']));

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['sometimes', 'nullable', 'string', 'max:120', Rule::in(self::ALLOWED_CATEGORIES)],
            'brand' => ['sometimes', 'nullable', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string'],
            'image_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'image' => ['sometimes', 'nullable', 'image', 'max:5120'],
            'remove_image' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($request->hasFile('image')) {
            $this->deleteProductImageIfLocal($product->image_url);
            $validated['image_url'] = $this->storeProductImage($request->file('image'));
        } elseif (!empty($validated['remove_image'])) {
            $this->deleteProductImageIfLocal($product->image_url);
            $validated['image_url'] = null;
        }

        $product->fill($validated)->save();

        $after = $this->productSnapshot($product->fresh(['variants']));
        AdminAudit::record(
            $request,
            'product.update',
            'product',
            $product->id,
            $before,
            $after
        );

        return response()->json([
            'product' => $product->fresh(['variants']),
        ]);
    }

    public function adminDestroy(Request $request, Product $product)
    {
        $before = $this->productSnapshot($product->load(['variants']));
        $this->deleteProductImageIfLocal($product->image_url);

        $product->delete();

        AdminAudit::record(
            $request,
            'product.delete',
            'product',
            $product->id,
            $before,
            null
        );

        return response()->json([
            'message' => 'Product deleted successfully.',
        ]);
    }

    public function adminAddVariant(Request $request, Product $product)
    {
        $before = $this->productSnapshot($product->load(['variants']));
        $validated = $request->validate([
            'color' => ['required', 'string', 'max:120'],
            'size' => ['required', 'string', 'max:120', Rule::in(self::ALLOWED_SIZES)],
            'price_mmk' => ['required', 'integer', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'sku' => ['nullable', 'string', 'max:120', 'unique:product_variants,sku'],
        ]);

        $variant = $product->variants()->create([
            'color' => $validated['color'],
            'size' => $validated['size'],
            'price_mmk' => (int) $validated['price_mmk'],
            'price' => $this->toUsdDecimal((int) $validated['price_mmk']),
            'stock' => (int) $validated['stock'],
            'sku' => $validated['sku'] ?? $this->generateSku($product, $validated['color'], $validated['size']),
        ]);

        $after = $this->productSnapshot($product->fresh(['variants']));
        AdminAudit::record(
            $request,
            'product.variant.create',
            'product_variant',
            $variant->id,
            $before,
            $after,
            [
                'product_id' => $product->id,
            ]
        );

        return response()->json([
            'variant' => $variant,
            'product' => $product->fresh(['variants']),
        ], 201);
    }

    public function adminUpdateVariant(Request $request, ProductVariant $variant)
    {
        $before = $this->variantSnapshot($variant);
        $validated = $request->validate([
            'color' => ['sometimes', 'required', 'string', 'max:120'],
            'size' => ['sometimes', 'required', 'string', 'max:120', Rule::in(self::ALLOWED_SIZES)],
            'price_mmk' => ['sometimes', 'required', 'integer', 'min:0'],
            'stock' => ['sometimes', 'required', 'integer', 'min:0'],
            'sku' => [
                'sometimes',
                'nullable',
                'string',
                'max:120',
                Rule::unique('product_variants', 'sku')->ignore($variant->id),
            ],
        ]);

        if (array_key_exists('price_mmk', $validated)) {
            $validated['price'] = $this->toUsdDecimal((int) $validated['price_mmk']);
        }

        if (array_key_exists('sku', $validated) && ! $validated['sku']) {
            $validated['sku'] = $this->generateSku(
                $variant->product,
                $validated['color'] ?? $variant->color,
                $validated['size'] ?? $variant->size
            );
        }

        $variant->fill($validated)->save();

        $after = $this->variantSnapshot($variant->fresh());
        AdminAudit::record(
            $request,
            'product.variant.update',
            'product_variant',
            $variant->id,
            $before,
            $after,
            [
                'product_id' => $variant->product_id,
            ]
        );

        return response()->json([
            'variant' => $variant->fresh(),
            'product' => $variant->product()->with('variants')->first(),
        ]);
    }

    public function adminDeleteVariant(Request $request, ProductVariant $variant)
    {
        $before = $this->variantSnapshot($variant);
        $product = $variant->product;

        if ($product->variants()->count() <= 1) {
            return response()->json([
                'message' => 'A product must keep at least one variant.',
            ], 422);
        }

        if (CartItem::query()->where('product_variant_id', $variant->id)->exists()) {
            return response()->json([
                'message' => 'Cannot delete variant that is currently in carts.',
            ], 409);
        }

        if (OrderItem::query()->where('product_variant_id', $variant->id)->exists()) {
            return response()->json([
                'message' => 'Cannot delete variant with order history.',
            ], 409);
        }

        $variant->delete();

        AdminAudit::record(
            $request,
            'product.variant.delete',
            'product_variant',
            $variant->id,
            $before,
            null,
            [
                'product_id' => $product->id,
            ]
        );

        return response()->json([
            'message' => 'Variant deleted successfully.',
            'product' => $product->fresh(['variants']),
        ]);
    }

    private function applyAdminSort(Builder $query, string $sort): void
    {
        if ($sort === 'name_asc') {
            $query->orderBy('name');
            return;
        }

        if ($sort === 'name_desc') {
            $query->orderByDesc('name');
            return;
        }

        if ($sort === 'price_asc') {
            $query->orderBy('variants_min_price_mmk')->orderBy('name');
            return;
        }

        if ($sort === 'price_desc') {
            $query->orderByDesc('variants_min_price_mmk')->orderBy('name');
            return;
        }

        if ($sort === 'oldest') {
            $query->orderBy('id');
            return;
        }

        $query->orderByDesc('id');
    }

    private function productSnapshot(Product $product): array
    {
        $product->loadMissing(['variants']);

        return [
            'id' => $product->id,
            'name' => $product->name,
            'category' => $product->category,
            'brand' => $product->brand,
            'description' => $product->description,
            'image_url' => $product->image_url,
            'is_active' => (bool) $product->is_active,
            'variants' => $product->variants
                ->map(fn (ProductVariant $variant) => $this->variantSnapshot($variant))
                ->values()
                ->all(),
        ];
    }

    private function variantSnapshot(ProductVariant $variant): array
    {
        return [
            'id' => $variant->id,
            'product_id' => $variant->product_id,
            'color' => $variant->color,
            'size' => $variant->size,
            'price_mmk' => (int) $variant->price_mmk,
            'stock' => (int) $variant->stock,
            'sku' => $variant->sku,
        ];
    }

    private function generateSku(Product $product, string $color, string $size): string
    {
        $base = Str::upper('P'.$product->id.'-'.Str::slug($color).'-'.Str::slug($size));
        $candidate = $base;
        $suffix = 1;
        while (ProductVariant::query()->where('sku', $candidate)->exists()) {
            $suffix++;
            $candidate = $base.'-'.$suffix;
        }

        return $candidate;
    }

    private function toUsdDecimal(int $priceMmk): float
    {
        $rate = max(1, (int) config('money.mmk_per_usd', (int) env('MMK_PER_USD', 2100)));

        return round($priceMmk / $rate, 2);
    }

    private function storeProductImage(\Illuminate\Http\UploadedFile $file): string
    {
        $extension = $file->guessExtension() ?: 'jpg';
        $path = $file->storeAs('products', uniqid('', true).'.'.$extension, 'public');

        return Storage::disk('public')->url($path);
    }

    private function deleteProductImageIfLocal(?string $url): void
    {
        if (! $url) {
            return;
        }

        $prefix = Storage::disk('public')->url('');
        if (! Str::startsWith($url, $prefix)) {
            return;
        }

        $path = Str::after($url, $prefix);
        if ($path !== '') {
            Storage::disk('public')->delete(ltrim($path, '/'));
        }
    }

}
