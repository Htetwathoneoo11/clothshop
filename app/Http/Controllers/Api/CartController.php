<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\ProductVariant;
use App\Services\CouponService;
use App\Support\MmkMoney;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function index(Request $request, CouponService $coupons)
    {
        $this->assertPurchasableUser($request);
        $coupons->ensureCreditRewardCoupon($request->user());

        $cart = $this->userCart($request);
        $items = $cart->items()->with('variant.product')->get();

        $subtotalMmk = (int) $items->sum(
            fn ($item) => (int) $item->quantity * (int) $item->unit_price_mmk
        );
        $cart->load('coupon');
        $appliedCoupon = $cart->coupon && $cart->coupon->isUsable() ? $cart->coupon : null;
        if ($cart->coupon_id && ! $appliedCoupon) {
            $cart->forceFill(['coupon_id' => null])->save();
        }

        $discountMmk = $appliedCoupon ? $coupons->discountMmk($subtotalMmk, $appliedCoupon) : 0;
        $totalMmk = max(0, $subtotalMmk - $discountMmk);
        $availableCoupons = Coupon::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('used_at')
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (Coupon $coupon): bool => $coupon->isUsable())
            ->values()
            ->map(fn (Coupon $coupon): array => $this->serializeCoupon($coupon))
            ->all();

        return response()->json([
            'items' => $items,
            'subtotal_mmk' => $subtotalMmk,
            'subtotal' => MmkMoney::mmkToUsdDecimalString($subtotalMmk),
            'discount_mmk' => $discountMmk,
            'total_mmk' => $totalMmk,
            'applied_coupon' => $appliedCoupon ? $this->serializeCoupon($appliedCoupon) : null,
            'available_coupons' => $availableCoupons,
            'currency_code' => 'MMK',
        ]);
    }

    public function store(Request $request)
    {
        $this->assertPurchasableUser($request);

        $validated = $request->validate([
            'variant_id' => 'required|exists:product_variants,id',
            'quantity' => 'nullable|integer|min:1',
        ]);

        $quantity = $validated['quantity'] ?? 1;
        $variant = ProductVariant::findOrFail($validated['variant_id']);

        if ($variant->stock < 1) {
            return response()->json(['message' => 'This product is out of stock.'], 409);
        }

        $cart = $this->userCart($request);
        $cartItem = $cart->items()->where('product_variant_id', $variant->id)->first();

        if ($cartItem) {
            if ($cartItem->quantity + $quantity > $variant->stock) {
                return response()->json(['message' => 'Not enough stock available.'], 409);
            }
            $cartItem->increment('quantity', $quantity);
        } else {
            if ($quantity > $variant->stock) {
                return response()->json(['message' => 'Not enough stock available.'], 409);
            }
            $cart->items()->create([
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'unit_price' => $variant->price,
                'unit_price_mmk' => (int) $variant->price_mmk,
            ]);
        }

        return response()->json(['message' => 'Added to cart.']);
    }

    public function update(CartItem $cartItem, Request $request)
    {
        $this->assertPurchasableUser($request);
        $this->authorizeItem($cartItem, $request);

        $validated = $request->validate([
            'quantity' => 'required|integer|min:1',
        ]);

        if ($validated['quantity'] > $cartItem->variant->stock) {
            return response()->json(['message' => 'Requested quantity is more than stock.'], 409);
        }

        $cartItem->update(['quantity' => $validated['quantity']]);

        return response()->json(['message' => 'Cart updated.']);
    }

    public function destroy(CartItem $cartItem, Request $request)
    {
        $this->assertPurchasableUser($request);
        $this->authorizeItem($cartItem, $request);
        $cartItem->delete();

        return response()->json(['message' => 'Item removed.']);
    }

    public function applyCoupon(Request $request, CouponService $coupons)
    {
        $this->assertPurchasableUser($request);
        $coupons->ensureCreditRewardCoupon($request->user());

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:100'],
        ]);
        $code = trim($validated['code']);
        $coupon = Coupon::query()
            ->where('user_id', $request->user()->id)
            ->where('code', $code)
            ->get()
            ->first(fn (Coupon $candidate): bool => hash_equals($candidate->code, $code));

        if (! $coupon || ! $coupon->isUsable()) {
            return response()->json(['message' => 'This coupon is invalid or has already been used.'], 422);
        }

        $cart = $this->userCart($request);
        if (! $cart->items()->exists()) {
            return response()->json(['message' => 'Add items to your cart before applying a coupon.'], 422);
        }

        $cart->forceFill(['coupon_id' => $coupon->id])->save();

        return response()->json([
            'message' => 'Coupon applied.',
            'coupon' => $this->serializeCoupon($coupon),
        ]);
    }

    public function removeCoupon(Request $request)
    {
        $this->assertPurchasableUser($request);

        $this->userCart($request)->forceFill(['coupon_id' => null])->save();

        return response()->json(['message' => 'Coupon removed.']);
    }

    private function userCart(Request $request): Cart
    {
        return Cart::firstOrCreate(['user_id' => $request->user()->id]);
    }

    private function authorizeItem(CartItem $cartItem, Request $request): void
    {
        abort_unless($cartItem->cart->user_id === $request->user()->id, 403);
    }

    private function assertPurchasableUser(Request $request): void
    {
        abort_if($request->user()?->isAdmin(), 403, 'Admins cannot use cart or checkout.');
    }

    private function serializeCoupon(Coupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'discount_percent' => (int) $coupon->discount_percent,
            'threshold_mmk' => (int) $coupon->threshold_mmk,
            'expires_at' => $coupon->expires_at?->toIso8601String(),
        ];
    }
}
