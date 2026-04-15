<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CheckoutController extends Controller
{
    public function store(Request $request)
    {
        $userId = $request->user()->id;

        try {
            DB::transaction(function () use ($userId): void {
                $cart = Cart::firstOrCreate(['user_id' => $userId]);
                $items = $cart->items()->with('variant.product')->lockForUpdate()->get();

                if ($items->isEmpty()) {
                    throw new RuntimeException('Your cart is empty.');
                }

                $variantIds = $items->pluck('product_variant_id')->unique()->values();
                $variants = ProductVariant::whereIn('id', $variantIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                foreach ($items as $item) {
                    $variant = $variants->get($item->product_variant_id);
                    if (! $variant || $item->quantity > $variant->stock) {
                        $name = $item->variant->product->name ?? 'this product';
                        $color = $item->variant->color ?? '-';
                        $size = $item->variant->size ?? '-';
                        throw new RuntimeException("Insufficient stock for {$name} ({$color}/{$size}).");
                    }
                }

                $total = 0;
                $order = Order::create([
                    'user_id' => $userId,
                    'total_amount' => 0,
                    'status' => Order::STATUS_PAID,
                ]);

                foreach ($items as $item) {
                    $lineTotal = round($item->quantity * (float) $item->unit_price, 2);
                    $total += $lineTotal;

                    $order->items()->create([
                        'product_variant_id' => $item->product_variant_id,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'line_total' => $lineTotal,
                    ]);

                    $affected = ProductVariant::whereKey($item->product_variant_id)
                        ->where('stock', '>=', $item->quantity)
                        ->decrement('stock', $item->quantity);

                    if ($affected === 0) {
                        $name = $item->variant->product->name ?? 'this product';
                        $color = $item->variant->color ?? '-';
                        $size = $item->variant->size ?? '-';
                        throw new RuntimeException("Insufficient stock for {$name} ({$color}/{$size}).");
                    }
                }

                $order->update(['total_amount' => round($total, 2)]);
                $cart->items()->delete();
            }, 3);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return response()->json(['message' => 'Checkout successful.']);
    }
}
