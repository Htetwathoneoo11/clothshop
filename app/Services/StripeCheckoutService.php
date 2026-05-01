<?php

namespace App\Services;

use App\Models\Order;
use App\Support\MmkMoney;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class StripeCheckoutService
{
    public function createSession(Order $order): array
    {
        $secret = $this->secretKey();
        $user = $order->user;
        $currency = strtolower((string) config('services.stripe.currency', 'usd'));
        $unitAmount = max(50, (int) round(((float) $order->total_amount) * 100));
        $appUrl = rtrim((string) config('app.url'), '/');

        try {
            $response = Http::asForm()
                ->withToken($secret)
                ->post('https://api.stripe.com/v1/checkout/sessions', [
                    'mode' => 'payment',
                    'client_reference_id' => (string) $order->id,
                    'success_url' => $appUrl.'/clothshop/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}',
                    'cancel_url' => $appUrl.'/clothshop/payment/stripe/cancel?order_id='.$order->id,
                    'customer_email' => $user?->email,
                    'metadata' => [
                        'order_id' => (string) $order->id,
                        'user_id' => (string) $order->user_id,
                        'total_amount_mmk' => (string) $order->total_amount_mmk,
                    ],
                    'line_items' => [[
                        'quantity' => 1,
                        'price_data' => [
                            'currency' => $currency,
                            'unit_amount' => $unitAmount,
                            'product_data' => [
                                'name' => 'Clothshop order #'.$order->id,
                                'description' => MmkMoney::mmkToUsdDecimalString((int) $order->total_amount_mmk).' USD equivalent for sandbox payment',
                            ],
                        ],
                    ]],
                ])
                ->throw();
        } catch (RequestException $exception) {
            throw new RuntimeException($exception->response?->json('error.message') ?: 'Stripe Checkout session could not be created.');
        }

        return $response->json();
    }

    public function retrieveSession(string $sessionId): array
    {
        try {
            return Http::withToken($this->secretKey())
                ->get('https://api.stripe.com/v1/checkout/sessions/'.$sessionId)
                ->throw()
                ->json();
        } catch (RequestException $exception) {
            throw new RuntimeException($exception->response?->json('error.message') ?: 'Stripe Checkout session could not be retrieved.');
        }
    }

    public function verifyWebhookSignature(string $payload, ?string $signatureHeader): bool
    {
        $secret = (string) config('services.stripe.webhook_secret');
        if ($secret === '' || ! $signatureHeader) {
            return false;
        }

        $parts = [];
        foreach (explode(',', $signatureHeader) as $piece) {
            [$key, $value] = array_pad(explode('=', trim($piece), 2), 2, null);
            if ($key && $value) {
                $parts[$key][] = $value;
            }
        }

        $timestamp = $parts['t'][0] ?? null;
        $signatures = $parts['v1'] ?? [];
        if (! $timestamp || $signatures === [] || abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$payload, $secret);

        foreach ($signatures as $signature) {
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        return false;
    }

    private function secretKey(): string
    {
        $secret = (string) config('services.stripe.secret');
        if ($secret === '') {
            throw new RuntimeException('Stripe is not configured. Add STRIPE_SECRET_KEY to your .env file.');
        }

        return $secret;
    }
}
