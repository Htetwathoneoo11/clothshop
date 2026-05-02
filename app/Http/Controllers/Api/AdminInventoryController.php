<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryAdjustment;
use App\Models\ProductVariant;
use App\Support\AdminAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminInventoryController extends Controller
{
    public function variants(Request $request)
    {
        $search = trim((string) $request->query('q', ''));

        $variants = ProductVariant::query()
            ->with('product')
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $subQuery) use ($search): void {
                    if (ctype_digit($search)) {
                        $subQuery->where('id', (int) $search);
                    }

                    $subQuery->orWhere('sku', 'like', '%'.$search.'%')
                        ->orWhere('color', 'like', '%'.$search.'%')
                        ->orWhere('size', 'like', '%'.$search.'%')
                        ->orWhereHas('product', function (Builder $productQuery) use ($search): void {
                            $productQuery->where('name', 'like', '%'.$search.'%')
                                ->orWhere('brand', 'like', '%'.$search.'%')
                                ->orWhere('category', 'like', '%'.$search.'%');
                        });
                });
            })
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit(12)
            ->get()
            ->map(fn (ProductVariant $variant): array => $this->serializeVariantOption($variant))
            ->values();

        return response()->json([
            'variants' => $variants,
        ]);
    }

    public function index(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $reason = trim((string) $request->query('reason', 'all'));
        $direction = trim((string) $request->query('direction', 'all'));
        $variantId = trim((string) $request->query('variant_id', 'all'));
        $sort = trim((string) $request->query('sort', 'newest'));
        $perPage = max(1, min(30, (int) $request->query('per_page', 10)));

        $adjustments = InventoryAdjustment::query()
            ->with(['actor', 'variant.product'])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $subQuery) use ($search): void {
                    if (ctype_digit($search)) {
                        $subQuery->where('id', (int) $search)
                            ->orWhere('product_variant_id', (int) $search);
                    }

                    $subQuery->orWhere('reason', 'like', '%'.$search.'%')
                        ->orWhere('note', 'like', '%'.$search.'%')
                        ->orWhereHas('variant', function (Builder $variantQuery) use ($search): void {
                            $variantQuery->where('sku', 'like', '%'.$search.'%')
                                ->orWhere('color', 'like', '%'.$search.'%')
                                ->orWhere('size', 'like', '%'.$search.'%')
                                ->orWhereHas('product', function (Builder $productQuery) use ($search): void {
                                    $productQuery->where('name', 'like', '%'.$search.'%')
                                        ->orWhere('brand', 'like', '%'.$search.'%')
                                        ->orWhere('category', 'like', '%'.$search.'%');
                                });
                        })
                        ->orWhereHas('actor', function (Builder $actorQuery) use ($search): void {
                            $actorQuery->where('username', 'like', '%'.$search.'%')
                                ->orWhere('email', 'like', '%'.$search.'%');
                        });
                });
            })
            ->when(in_array($reason, InventoryAdjustment::REASONS, true), fn (Builder $query) => $query->where('reason', $reason))
            ->when(ctype_digit($variantId), fn (Builder $query) => $query->where('product_variant_id', (int) $variantId))
            ->when($direction === 'increase', fn (Builder $query) => $query->where('adjustment', '>', 0))
            ->when($direction === 'decrease', fn (Builder $query) => $query->where('adjustment', '<', 0));

        $this->applySort($adjustments, $sort);

        $paginated = $adjustments->paginate($perPage)->withQueryString();

        return response()->json([
            'adjustments' => collect($paginated->items())
                ->map(fn (InventoryAdjustment $adjustment) => $this->serializeAdjustment($adjustment))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'filters' => [
                'q' => $search,
                'reason' => $reason,
                'direction' => $direction,
                'variant_id' => $variantId,
                'sort' => $sort,
            ],
            'reasons' => InventoryAdjustment::REASONS,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'adjustment' => ['required', 'integer', 'min:-100000', 'max:100000', 'not_in:0'],
            'reason' => ['required', 'string', Rule::in(InventoryAdjustment::REASONS)],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $adjustment = DB::transaction(function () use ($request, $validated): InventoryAdjustment {
            $variant = ProductVariant::query()
                ->with('product')
                ->whereKey((int) $validated['product_variant_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $previousStock = (int) $variant->stock;
            $change = (int) $validated['adjustment'];
            $newStock = $previousStock + $change;

            if ($newStock < 0) {
                throw ValidationException::withMessages([
                    'adjustment' => ['Stock adjustment cannot reduce stock below zero.'],
                ]);
            }

            $variant->forceFill(['stock' => $newStock])->save();

            $created = InventoryAdjustment::query()->create([
                'product_variant_id' => $variant->id,
                'actor_id' => $request->user()?->id,
                'previous_stock' => $previousStock,
                'adjustment' => $change,
                'new_stock' => $newStock,
                'reason' => $validated['reason'],
                'note' => $validated['note'] ?? null,
            ]);

            AdminAudit::record(
                $request,
                'inventory.adjust',
                'product_variant',
                $variant->id,
                [
                    'stock' => $previousStock,
                    'variant_id' => $variant->id,
                    'product_id' => $variant->product_id,
                ],
                [
                    'stock' => $newStock,
                    'adjustment' => $change,
                    'reason' => $validated['reason'],
                ],
                [
                    'inventory_adjustment_id' => $created->id,
                ],
            );

            return $created;
        });

        return response()->json([
            'adjustment' => $this->serializeAdjustment($adjustment->fresh(['actor', 'variant.product'])),
        ], 201);
    }

    public function show(InventoryAdjustment $inventoryAdjustment)
    {
        return response()->json([
            'adjustment' => $this->serializeAdjustment($inventoryAdjustment->load(['actor', 'variant.product'])),
        ]);
    }

    private function serializeAdjustment(InventoryAdjustment $adjustment): array
    {
        $variant = $adjustment->variant;
        $product = $variant?->product;

        return [
            'id' => $adjustment->id,
            'product_variant_id' => $adjustment->product_variant_id,
            'previous_stock' => (int) $adjustment->previous_stock,
            'adjustment' => (int) $adjustment->adjustment,
            'new_stock' => (int) $adjustment->new_stock,
            'reason' => $adjustment->reason,
            'note' => $adjustment->note,
            'created_at' => $adjustment->created_at?->toIso8601String(),
            'actor' => $adjustment->actor ? [
                'id' => $adjustment->actor->id,
                'username' => $adjustment->actor->username,
                'email' => $adjustment->actor->email,
            ] : null,
            'variant' => $variant ? [
                'id' => $variant->id,
                'sku' => $variant->sku,
                'color' => $variant->color,
                'size' => $variant->size,
                'stock' => (int) $variant->stock,
                'product' => $product ? [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category,
                    'brand' => $product->brand,
                ] : null,
            ] : null,
        ];
    }

    private function serializeVariantOption(ProductVariant $variant): array
    {
        $product = $variant->product;

        return [
            'id' => $variant->id,
            'sku' => $variant->sku,
            'color' => $variant->color,
            'size' => $variant->size,
            'stock' => (int) $variant->stock,
            'product' => $product ? [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'brand' => $product->brand,
            ] : null,
        ];
    }

    private function applySort(Builder $query, string $sort): void
    {
        if ($sort === 'oldest') {
            $query->orderBy('id');
            return;
        }

        if ($sort === 'largest_change') {
            $query->orderByRaw('ABS(adjustment) DESC')->orderByDesc('id');
            return;
        }

        $query->orderByDesc('id');
    }
}
