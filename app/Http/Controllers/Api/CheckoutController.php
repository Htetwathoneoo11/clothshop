<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CheckoutController extends Controller
{
    public function store(Request $request)
    {
        $cart = Cart::firstOrCreate(['user_id' => $request->user()->id]);
        $items = $cart->items()->with('variant.product')->get();

        if ($items->isEmpty()) {
            return response()->json(['message' => 'Your cart is empty.'], 409);
        }

        foreach ($items as $item) {
            if ($item->quantity > $item->variant->stock) {
                return response()->json([
                    'message' => "Insufficient stock for {$item->variant->product->name} ({$item->variant->color}/{$item->variant->size}).",
                ], 409);
            }
        }

        DB::transaction(function () use ($items, $cart, $request): void {
            $total = 0;
            $order = Order::create([
                'user_id' => $request->user()->id,
                'total_amount' => 0,
                'status' => 'paid',
            ]);

            foreach ($items as $item) {
                $lineTotal = $item->quantity * $item->unit_price;
                $total += $lineTotal;

                $order->items()->create([
                    'product_variant_id' => $item->product_variant_id,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_total' => $lineTotal,
                ]);

                $item->variant->decrement('stock', $item->quantity);
            }

            $order->update(['total_amount' => $total]);
            $cart->items()->delete();
        });

        return response()->json(['message' => 'Checkout successful.']);
    }
}
