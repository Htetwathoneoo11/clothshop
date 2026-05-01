<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\CreditScoreService;
use App\Services\StripeCheckoutService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $orders = Order::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('status', [Order::STATUS_PENDING, Order::STATUS_PAID, Order::STATUS_FAILED, Order::STATUS_CANCELLED])
            ->with(['items.variant.product'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'orders' => $orders->map(fn (Order $order) => $this->serializeOrder($order))->values(),
        ]);
    }

    public function show(Request $request, Order $order)
    {
        abort_unless((int) $order->user_id === (int) $request->user()->id, 404);

        return response()->json([
            'order' => $this->serializeOrder($order->load(['items.variant.product'])),
        ]);
    }

    public function createStripeCheckoutSession(
        Request $request,
        Order $order,
        StripeCheckoutService $stripeCheckout
    ) {
        abort_unless((int) $order->user_id === (int) $request->user()->id, 404);

        if ($order->payment_method !== Order::PAYMENT_STRIPE_CHECKOUT) {
            return response()->json(['message' => 'This order does not use Stripe Checkout.'], 422);
        }

        if ($order->status === Order::STATUS_PAID) {
            return response()->json(['message' => 'This order has already been paid.'], 422);
        }

        if ($order->status !== Order::STATUS_PENDING) {
            return response()->json(['message' => 'This order cannot be paid right now.'], 422);
        }

        if ($order->stripe_checkout_session_id) {
            try {
                $session = $stripeCheckout->retrieveSession($order->stripe_checkout_session_id);
                if (! empty($session['url'])) {
                    return response()->json([
                        'checkout_url' => $session['url'],
                        'session_id' => $session['id'],
                    ]);
                }
            } catch (RuntimeException) {
                $order->forceFill(['stripe_checkout_session_id' => null])->save();
            }
        }

        try {
            $session = $stripeCheckout->createSession($order->load('user'));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        $order->forceFill([
            'stripe_checkout_session_id' => $session['id'] ?? null,
        ])->save();

        return response()->json([
            'checkout_url' => $session['url'] ?? null,
            'session_id' => $session['id'] ?? null,
        ]);
    }

    public function confirmStripeCheckout(
        Request $request,
        StripeCheckoutService $stripeCheckout,
        CreditScoreService $creditScore
    ) {
        $validated = $request->validate([
            'session_id' => ['required', 'string'],
        ]);

        try {
            $session = $stripeCheckout->retrieveSession($validated['session_id']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        $order = $this->orderFromStripeSession($session);
        abort_unless($order && (int) $order->user_id === (int) $request->user()->id, 404);

        $this->syncOrderFromStripeSession($order, $session, $creditScore);
        $order->refresh()->load(['items.variant.product']);

        return response()->json([
            'message' => $order->status === Order::STATUS_PAID
                ? 'Payment confirmed. Your order is paid.'
                : 'Payment is not complete yet.',
            'order' => $this->serializeOrder($order),
        ]);
    }

    public function stripeWebhook(
        Request $request,
        StripeCheckoutService $stripeCheckout,
        CreditScoreService $creditScore
    ) {
        $payload = $request->getContent();
        if (! $stripeCheckout->verifyWebhookSignature($payload, $request->header('Stripe-Signature'))) {
            return response()->json(['message' => 'Invalid Stripe signature.'], 400);
        }

        $event = json_decode($payload, true);
        if (! is_array($event)) {
            return response()->json(['message' => 'Invalid Stripe payload.'], 400);
        }

        $type = $event['type'] ?? '';
        $session = $event['data']['object'] ?? [];

        if (in_array($type, ['checkout.session.completed', 'checkout.session.async_payment_failed'], true)
            && is_array($session)) {
            $order = $this->orderFromStripeSession($session);
            if ($order) {
                $this->syncOrderFromStripeSession($order, $session, $creditScore, $type);
            }
        }

        return response()->json(['received' => true]);
    }

    private function serializeOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'total_amount' => (string) $order->total_amount,
            'total_amount_mmk' => (int) $order->total_amount_mmk,
            'discount_mmk' => (int) $order->discount_mmk,
            'credit_earned_mmk' => $order->credit_awarded_at ? (int) $order->total_amount_mmk : 0,
            'currency_code' => 'MMK',
            'status' => $order->status,
            'created_at' => $order->created_at?->toIso8601String(),
            'paid_at' => $order->paid_at?->toIso8601String(),
            'credit_awarded_at' => $order->credit_awarded_at?->toIso8601String(),
            'payment' => [
                'method' => $order->payment_method,
                'coupon_code' => $order->coupon_code,
                'coupon_discount_percent' => (int) $order->coupon_discount_percent,
                'stripe_checkout_session_id' => $order->stripe_checkout_session_id,
            ],
            'delivery' => [
                'name' => $order->name,
                'phone_number' => $order->phone_number,
                'delivery_date' => $order->delivery_date,
                'delivery_time' => $order->delivery_time,
                'building_or_flat' => $order->building_or_flat,
                'street_or_road' => $order->street_or_road,
                'township' => $order->township,
                'city' => $order->city,
                'payment_method' => $order->payment_method,
            ],
            'items' => $order->items->map(function ($item) {
                $variant = $item->variant;
                $product = $variant?->product;

                return [
                    'quantity' => $item->quantity,
                    'unit_price' => (string) $item->unit_price,
                    'line_total' => (string) $item->line_total,
                    'unit_price_mmk' => (int) $item->unit_price_mmk,
                    'line_total_mmk' => (int) $item->line_total_mmk,
                    'product_name' => $product?->name ?? 'Product',
                    'color' => $variant?->color,
                    'size' => $variant?->size,
                ];
            })->values()->all(),
        ];
    }

    private function orderFromStripeSession(array $session): ?Order
    {
        $sessionId = $session['id'] ?? null;
        $orderId = $session['metadata']['order_id'] ?? $session['client_reference_id'] ?? null;

        if (! $sessionId && ! $orderId) {
            return null;
        }

        return Order::query()
            ->where(function ($query) use ($sessionId, $orderId): void {
                if ($sessionId) {
                    $query->orWhere('stripe_checkout_session_id', $sessionId);
                }
                if ($orderId) {
                    $query->orWhere('id', $orderId);
                }
            })
            ->first();
    }

    private function syncOrderFromStripeSession(
        Order $order,
        array $session,
        CreditScoreService $creditScore,
        ?string $eventType = null
    ): void {
        DB::transaction(function () use ($order, $session, $creditScore, $eventType): void {
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $paymentStatus = $session['payment_status'] ?? null;
            $sessionStatus = $session['status'] ?? null;
            $paymentIntent = $session['payment_intent'] ?? null;

            if ($eventType === 'checkout.session.async_payment_failed') {
                $locked->forceFill([
                    'status' => Order::STATUS_FAILED,
                    'stripe_payment_intent_id' => $paymentIntent,
                ])->save();
                return;
            }

            if ($paymentStatus === 'paid' || $sessionStatus === 'complete') {
                $locked->forceFill([
                    'status' => Order::STATUS_PAID,
                    'stripe_checkout_session_id' => $session['id'] ?? $locked->stripe_checkout_session_id,
                    'stripe_payment_intent_id' => $paymentIntent,
                    'paid_at' => $locked->paid_at ?: now(),
                ])->save();
                $creditScore->awardForPaidOrder($locked->fresh());
            }
        });
    }
}
