<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminReportController extends Controller
{
    public function index(Request $request)
    {
        [$from, $to, $days] = $this->dateRange($request);
        [$previousFrom, $previousTo] = [
            $from->subDays($days),
            $from->subSecond(),
        ];

        $ordersInRange = fn (): Builder => Order::query()->whereBetween('created_at', [$from, $to]);
        $paidOrdersInRange = fn (): Builder => $ordersInRange()->where('status', Order::STATUS_PAID);
        $previousPaidOrders = fn (): Builder => Order::query()
            ->where('status', Order::STATUS_PAID)
            ->whereBetween('created_at', [$previousFrom, $previousTo]);

        $paidRevenue = (int) $paidOrdersInRange()->sum('total_amount_mmk');
        $paidCount = (int) $paidOrdersInRange()->count();
        $previousRevenue = (int) $previousPaidOrders()->sum('total_amount_mmk');
        $previousPaidCount = (int) $previousPaidOrders()->count();

        return response()->json([
            'range' => [
                'days' => $days,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'summary' => [
                'paid_revenue_mmk' => $paidRevenue,
                'paid_revenue_change_percent' => $this->percentChange($previousRevenue, $paidRevenue),
                'orders_total' => (int) $ordersInRange()->count(),
                'orders_paid' => $paidCount,
                'paid_orders_change_percent' => $this->percentChange($previousPaidCount, $paidCount),
                'average_order_value_mmk' => $paidCount > 0 ? intdiv($paidRevenue, $paidCount) : 0,
                'discounts_mmk' => (int) $paidOrdersInRange()->sum('discount_mmk'),
                'new_customers' => (int) User::query()
                    ->where('role', User::ROLE_USER)
                    ->whereBetween('created_at', [$from, $to])
                    ->count(),
            ],
            'sales_trend' => $this->salesTrend($from, $to),
            'orders_by_status' => $this->ordersByStatus($from, $to),
            'payment_methods' => $this->paymentMethods($from, $to),
            'top_products' => $this->topProducts($from, $to),
            'inventory' => $this->inventorySnapshot(),
            'customers' => $this->customerSnapshot($from, $to),
        ]);
    }

    private function dateRange(Request $request): array
    {
        $days = (int) $request->query('days', 30);
        if (! in_array($days, [7, 30, 90, 365], true)) {
            $days = 30;
        }

        $to = CarbonImmutable::today()->endOfDay();
        $from = $to->subDays($days - 1)->startOfDay();

        return [$from, $to, $days];
    }

    private function salesTrend(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $seed = [];
        for ($day = $from; $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
            $seed[$day->toDateString()] = [
                'date' => $day->toDateString(),
                'orders' => 0,
                'paid_orders' => 0,
                'paid_revenue_mmk' => 0,
            ];
        }

        Order::query()
            ->selectRaw(
                'DATE(created_at) as day, COUNT(*) as orders, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as paid_orders, SUM(CASE WHEN status = ? THEN total_amount_mmk ELSE 0 END) as paid_revenue_mmk',
                [Order::STATUS_PAID, Order::STATUS_PAID]
            )
            ->whereBetween('created_at', [$from, $to])
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->get()
            ->each(function ($row) use (&$seed): void {
                $day = (string) $row->day;
                if (! isset($seed[$day])) {
                    return;
                }
                $seed[$day]['orders'] = (int) $row->orders;
                $seed[$day]['paid_orders'] = (int) $row->paid_orders;
                $seed[$day]['paid_revenue_mmk'] = (int) $row->paid_revenue_mmk;
            });

        return array_values($seed);
    }

    private function ordersByStatus(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = Order::query()
            ->select('status', DB::raw('count(*) as aggregate'))
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return collect(Order::ALLOWED_STATUSES)
            ->map(fn (string $status): array => [
                'status' => $status,
                'count' => (int) ($counts[$status] ?? 0),
            ])
            ->values()
            ->all();
    }

    private function paymentMethods(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return Order::query()
            ->select('payment_method', DB::raw('count(*) as orders'), DB::raw('sum(total_amount_mmk) as revenue_mmk'))
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('payment_method')
            ->orderByDesc('orders')
            ->get()
            ->map(fn ($row): array => [
                'method' => $row->payment_method ?: 'unknown',
                'orders' => (int) $row->orders,
                'revenue_mmk' => (int) $row->revenue_mmk,
            ])
            ->values()
            ->all();
    }

    private function topProducts(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('product_variants', 'product_variants.id', '=', 'order_items.product_variant_id')
            ->join('products', 'products.id', '=', 'product_variants.product_id')
            ->where('orders.status', Order::STATUS_PAID)
            ->whereBetween('orders.created_at', [$from, $to])
            ->groupBy('products.id', 'products.name', 'products.category')
            ->selectRaw('products.id, products.name, products.category, SUM(order_items.quantity) as units_sold, SUM(order_items.line_total_mmk) as revenue_mmk')
            ->orderByDesc('revenue_mmk')
            ->limit(6)
            ->get()
            ->map(fn ($row): array => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'category' => $row->category,
                'units_sold' => (int) $row->units_sold,
                'revenue_mmk' => (int) $row->revenue_mmk,
            ])
            ->values()
            ->all();
    }

    private function inventorySnapshot(): array
    {
        $lowStockThreshold = 5;

        return [
            'total_variants' => (int) ProductVariant::query()->count(),
            'total_units' => (int) ProductVariant::query()->sum('stock'),
            'stock_value_mmk' => (int) ProductVariant::query()->sum(DB::raw('stock * price_mmk')),
            'low_stock_variants' => (int) ProductVariant::query()
                ->where('stock', '>', 0)
                ->where('stock', '<=', $lowStockThreshold)
                ->count(),
            'out_of_stock_variants' => (int) ProductVariant::query()->where('stock', '<=', 0)->count(),
            'at_risk_variants' => ProductVariant::query()
                ->with('product')
                ->where('stock', '<=', $lowStockThreshold)
                ->orderBy('stock')
                ->limit(6)
                ->get()
                ->map(fn (ProductVariant $variant): array => [
                    'id' => $variant->id,
                    'sku' => $variant->sku,
                    'stock' => (int) $variant->stock,
                    'color' => $variant->color,
                    'size' => $variant->size,
                    'product' => $variant->product ? [
                        'id' => $variant->product->id,
                        'name' => $variant->product->name,
                    ] : null,
                ])
                ->values()
                ->all(),
        ];
    }

    private function customerSnapshot(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $activeCustomerIds = Order::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('user_id')
            ->distinct()
            ->pluck('user_id');

        $repeatCustomers = Order::query()
            ->select('user_id', DB::raw('count(*) as orders_count'))
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->having('orders_count', '>', 1)
            ->count();

        return [
            'total_customers' => (int) User::query()->where('role', User::ROLE_USER)->count(),
            'active_customers' => $activeCustomerIds->count(),
            'repeat_customers' => (int) $repeatCustomers,
            'top_customers' => Order::query()
                ->with('user')
                ->select('user_id', DB::raw('count(*) as orders_count'), DB::raw('sum(total_amount_mmk) as spend_mmk'))
                ->where('status', Order::STATUS_PAID)
                ->whereBetween('created_at', [$from, $to])
                ->whereNotNull('user_id')
                ->groupBy('user_id')
                ->orderByDesc('spend_mmk')
                ->limit(5)
                ->get()
                ->map(fn (Order $order): array => [
                    'id' => $order->user?->id,
                    'username' => $order->user?->username ?? 'Unknown',
                    'email' => $order->user?->email,
                    'orders_count' => (int) $order->orders_count,
                    'spend_mmk' => (int) $order->spend_mmk,
                ])
                ->values()
                ->all(),
        ];
    }

    private function percentChange(int $previous, int $current): ?float
    {
        if ($previous === 0) {
            return $current === 0 ? 0.0 : null;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }
}
