<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\ProductVariant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CartController extends Controller
{
    public function index(Request $request): View
    {
        $cart = $this->userCart($request);
        $items = $cart->items()->with('variant.product')->get();
        $subtotal = $items->sum(fn (CartItem $item) => $item->quantity * $item->unit_price);

        return view('cart.index', compact('items', 'subtotal'));
    }

    public function add(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'variant_id' => 'required|exists:product_variants,id',
        ]);

        $variant = ProductVariant::findOrFail($validated['variant_id']);

        if ($variant->stock < 1) {
            return back()->with('error', 'This product is out of stock.');
        }

        $cart = $this->userCart($request);
        $cartItem = $cart->items()->where('product_variant_id', $variant->id)->first();

        if ($cartItem) {
            if ($cartItem->quantity >= $variant->stock) {
                return back()->with('error', 'Not enough stock available.');
            }

            $cartItem->increment('quantity');
        } else {
            $cart->items()->create([
                'product_variant_id' => $variant->id,
                'quantity' => 1,
                'unit_price' => $variant->price,
            ]);
        }

        return redirect()->route('cart.index')->with('success', 'Product added to cart.');
    }

    public function update(CartItem $cartItem, Request $request): RedirectResponse
    {
        $this->authorizeItem($cartItem, $request);

        $validated = $request->validate([
            'quantity' => 'required|integer|min:1',
        ]);

        if ($validated['quantity'] > $cartItem->variant->stock) {
            return back()->with('error', 'Requested quantity is more than stock.');
        }

        $cartItem->update(['quantity' => $validated['quantity']]);

        return redirect()->route('cart.index')->with('success', 'Cart updated.');
    }

    public function remove(CartItem $cartItem, Request $request): RedirectResponse
    {
        $this->authorizeItem($cartItem, $request);
        $cartItem->delete();

        return redirect()->route('cart.index')->with('success', 'Item removed from cart.');
    }

    private function userCart(Request $request): Cart
    {
        return Cart::firstOrCreate(['user_id' => $request->user()->id]);
    }

    private function authorizeItem(CartItem $cartItem, Request $request): void
    {
        abort_unless($cartItem->cart->user_id === $request->user()->id, 403);
    }
}
