<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * Past orders (completed or cancelled — excludes in-flight checkout states).
     */
    public function index(Request $request)
    {
        $orders = Order::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('status', [Order::STATUS_PAID, Order::STATUS_CANCELLED])
            ->with(['items.variant.product'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'orders' => $orders->map(fn (Order $order) => $this->serializeOrder($order))->values(),
        ]);
    }

    private function serializeOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'total_amount' => (string) $order->total_amount,
            'total_amount_mmk' => (int) $order->total_amount_mmk,
            'currency_code' => 'MMK',
            'status' => $order->status,
            'created_at' => $order->created_at?->toIso8601String(),
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
}
