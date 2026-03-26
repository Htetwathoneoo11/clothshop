<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Order;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class CheckoutController extends Controller
{
    public function index(Request $request): View|RedirectResponse
    {
        $cart = Cart::firstOrCreate(['user_id' => $request->user()->id]);
        $items = $cart->items()->with('variant.product')->get();

        if ($items->isEmpty()) {
            return redirect()->route('cart.index')->with('error', 'Your cart is empty.');
        }

        $subtotal = $items->sum(fn (CartItem $item) => $item->quantity * $item->unit_price);

        return view('checkout.index', compact('items', 'subtotal'));
    }

    public function store(Request $request): RedirectResponse
    {
        $cart = Cart::firstOrCreate(['user_id' => $request->user()->id]);
        $items = $cart->items()->with('variant.product')->get();

        if ($items->isEmpty()) {
            return redirect()->route('cart.index')->with('error', 'Your cart is empty.');
        }

        foreach ($items as $item) {
            if ($item->quantity > $item->variant->stock) {
                return redirect()
                    ->route('cart.index')
                    ->with('error', "Insufficient stock for {$item->variant->product->name} ({$item->variant->color}/{$item->variant->size}).");
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

        return redirect()->route('users.dashboard')->with('success', 'Checkout successful.');
    }
}
