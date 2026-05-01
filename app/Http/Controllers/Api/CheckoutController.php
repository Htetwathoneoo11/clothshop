<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Services\CouponService;
use App\Support\MmkMoney;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CheckoutController extends Controller
{
    public function store(Request $request, CouponService $coupons)
    {
        abort_if($request->user()?->isAdmin(), 403, 'Admins cannot use cart or checkout.');
        abort_unless($request->user()?->hasVerifiedEmail(), 403, 'Please verify your email before checkout.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone_number' => ['required', 'string', 'max:50'],
            'delivery_date' => ['required', 'date'],
            'delivery_time' => ['required', 'date_format:H:i'],
            'building_or_flat' => ['required', 'string', 'max:255'],
            'street_or_road' => ['required', 'string', 'max:255'],
            'township' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'payment_method' => ['required', 'in:cash_on_delivery,card_on_delivery,stripe_checkout'],
        ]);

        $userId = $request->user()->id;

        $createdOrder = null;

        try {
            DB::transaction(function () use ($userId, $validated, &$createdOrder, $coupons): void {
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

                $subtotalMmk = 0;
                $coupon = $cart->coupon_id
                    ? Coupon::query()->whereKey($cart->coupon_id)->lockForUpdate()->first()
                    : null;
                if ($coupon && (! $coupon->isUsable() || (int) $coupon->user_id !== $userId)) {
                    throw new RuntimeException('This coupon is no longer available.');
                }

                $order = Order::create([
                    'user_id' => $userId,
                    'total_amount' => '0.00',
                    'total_amount_mmk' => 0,
                    'status' => Order::STATUS_PENDING,
                    'name' => $validated['name'],
                    'phone_number' => $validated['phone_number'],
                    'delivery_date' => $validated['delivery_date'],
                    'delivery_time' => $validated['delivery_time'],
                    'building_or_flat' => $validated['building_or_flat'],
                    'street_or_road' => $validated['street_or_road'],
                    'township' => $validated['township'],
                    'city' => $validated['city'],
                    'payment_method' => $validated['payment_method'],
                    'coupon_code' => $coupon?->code,
                    'coupon_discount_percent' => $coupon ? (int) $coupon->discount_percent : 0,
                ]);

                foreach ($items as $item) {
                    $unitMmk = (int) $item->unit_price_mmk;
                    $lineTotalMmk = MmkMoney::lineTotalMmk((int) $item->quantity, $unitMmk);
                    $unitPrice = number_format((float) $item->unit_price, 2, '.', '');
                    $lineTotal = number_format((float) $unitPrice * (int) $item->quantity, 2, '.', '');
                    $subtotalMmk += $lineTotalMmk;

                    $order->items()->create([
                        'product_variant_id' => $item->product_variant_id,
                        'quantity' => $item->quantity,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                        'unit_price_mmk' => $unitMmk,
                        'line_total_mmk' => $lineTotalMmk,
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

                $discountMmk = $coupon ? $coupons->discountMmk($subtotalMmk, $coupon) : 0;
                $totalMmk = max(0, $subtotalMmk - $discountMmk);

                $order->update([
                    'total_amount' => MmkMoney::mmkToUsdDecimalString($totalMmk),
                    'total_amount_mmk' => $totalMmk,
                    'discount_mmk' => $discountMmk,
                ]);
                if ($coupon) {
                    $coupon->forceFill([
                        'used_at' => now(),
                        'used_order_id' => $order->id,
                    ])->save();
                }
                $cart->items()->delete();
                $cart->forceFill(['coupon_id' => null])->save();
                $createdOrder = $order->fresh();
            }, 3);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        $paymentRequired = $createdOrder
            && in_array($createdOrder->payment_method, Order::ONLINE_PAYMENT_METHODS, true);

        return response()->json([
            'message' => 'Checkout successful.',
            'currency_code' => 'MMK',
            'order_id' => $createdOrder?->id,
            'status' => $createdOrder?->status,
            'payment_method' => $createdOrder?->payment_method,
            'payment_required' => $paymentRequired,
        ]);
    }
}
