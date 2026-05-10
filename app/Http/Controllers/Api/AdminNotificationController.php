<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\AdminNotificationReview;
use App\Models\Order;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminNotificationController extends Controller
{
    public function index(Request $request)
    {
        $reviewedIds = AdminNotificationReview::query()->pluck('notification_id')->all();

        $notifications = $this->generatedNotifications()
            ->reject(fn (array $notification): bool => in_array($notification['id'], $reviewedIds, true))
            ->values();

        return response()->json($this->payload($notifications));
    }

    public function review(Request $request, string $notificationId)
    {
        $notification = $this->generatedNotifications()
            ->firstWhere('id', $notificationId);

        if (! $notification) {
            return response()->json([
                'message' => 'Notification is no longer active.',
            ], 404);
        }

        AdminNotificationReview::query()->updateOrCreate(
            ['notification_id' => $notification['id']],
            [
                'reviewed_by' => $request->user()?->id,
                'type' => $notification['type'],
                'priority' => $notification['priority'],
                'title' => $notification['title'],
                'target_type' => $notification['target_type'],
                'target_id' => $notification['target_id'],
                'snapshot' => $notification,
                'reviewed_at' => now(),
            ]
        );

        $reviewedIds = AdminNotificationReview::query()->pluck('notification_id')->all();

        $remaining = $this->generatedNotifications()
            ->reject(fn (array $item): bool => in_array($item['id'], $reviewedIds, true))
            ->values();

        return response()->json(array_merge([
            'message' => 'Notification marked as reviewed.',
        ], $this->payload($remaining)));
    }

    public function bulkReview(Request $request)
    {
        $validated = $request->validate([
            'notification_ids' => ['required', 'array', 'min:1', 'max:50'],
            'notification_ids.*' => ['required', 'string'],
        ]);

        $active = $this->generatedNotifications()->keyBy('id');
        $reviewed = 0;

        foreach ($validated['notification_ids'] as $notificationId) {
            $notification = $active->get($notificationId);
            if (! $notification) {
                continue;
            }

            AdminNotificationReview::query()->updateOrCreate(
                ['notification_id' => $notification['id']],
                [
                    'reviewed_by' => $request->user()?->id,
                    'type' => $notification['type'],
                    'priority' => $notification['priority'],
                    'title' => $notification['title'],
                    'target_type' => $notification['target_type'],
                    'target_id' => $notification['target_id'],
                    'snapshot' => $notification,
                    'reviewed_at' => now(),
                ]
            );
            $reviewed++;
        }

        $reviewedIds = AdminNotificationReview::query()->pluck('notification_id')->all();
        $remaining = $this->generatedNotifications()
            ->reject(fn (array $item): bool => in_array($item['id'], $reviewedIds, true))
            ->values();

        return response()->json(array_merge([
            'message' => $reviewed.' notifications marked as reviewed.',
        ], $this->payload($remaining)));
    }

    public function reviews(Request $request)
    {
        $priority = (string) $request->query('priority', 'all');
        $type = trim((string) $request->query('type', ''));

        $reviews = AdminNotificationReview::query()
            ->with('reviewer')
            ->when(in_array($priority, ['critical', 'warning', 'info'], true), fn ($query) => $query->where('priority', $priority))
            ->when($type !== '', fn ($query) => $query->where('type', $type))
            ->orderByDesc('reviewed_at')
            ->get()
            ->map(fn (AdminNotificationReview $review): array => $this->serializeReview($review))
            ->values();

        return response()->json([
            'reviews' => $reviews,
        ]);
    }

    private function generatedNotifications()
    {
        return collect()
            ->merge($this->inventoryAlerts())
            ->merge($this->failedPaymentAlerts())
            ->merge($this->highValueOrderAlerts())
            ->merge($this->securityAlerts())
            ->sortBy([
                fn (array $a, array $b) => $this->priorityRank($a['priority']) <=> $this->priorityRank($b['priority']),
                fn (array $a, array $b) => strcmp($b['created_at'], $a['created_at']),
            ])
            ->values();
    }

    private function payload($notifications): array
    {
        return [
            'notifications' => $notifications->all(),
            'counts' => [
                'total' => $notifications->count(),
                'critical' => $notifications->where('priority', 'critical')->count(),
                'warning' => $notifications->where('priority', 'warning')->count(),
                'info' => $notifications->where('priority', 'info')->count(),
            ],
            'recent_reviews' => AdminNotificationReview::query()
                ->with('reviewer')
                ->orderByDesc('reviewed_at')
                ->limit(8)
                ->get()
                ->map(fn (AdminNotificationReview $review): array => $this->serializeReview($review))
                ->values()
                ->all(),
        ];
    }

    private function serializeReview(AdminNotificationReview $review): array
    {
        return [
            'id' => $review->id,
            'notification_id' => $review->notification_id,
            'type' => $review->type,
            'priority' => $review->priority,
            'title' => $review->title,
            'target_type' => $review->target_type,
            'target_id' => $review->target_id,
            'action_url' => $review->snapshot['action_url'] ?? null,
            'snapshot' => $review->snapshot,
            'reviewed_at' => $review->reviewed_at?->toIso8601String(),
            'reviewer' => $review->reviewer ? [
                'id' => $review->reviewer->id,
                'username' => $review->reviewer->username,
                'email' => $review->reviewer->email,
            ] : null,
        ];
    }

    private function inventoryAlerts(): array
    {
        $lowStockThreshold = 5;

        return ProductVariant::query()
            ->with('product')
            ->where('stock', '<=', $lowStockThreshold)
            ->orderBy('stock')
            ->limit(10)
            ->get()
            ->map(function (ProductVariant $variant): array {
                $out = (int) $variant->stock <= 0;

                return [
                    'id' => 'inventory-'.$variant->id,
                    'type' => $out ? 'out_of_stock' : 'low_stock',
                    'priority' => $out ? 'critical' : 'warning',
                    'title' => $out ? 'Variant out of stock' : 'Low stock variant',
                    'message' => ($variant->product?->name ?? 'Product').' has '.$variant->stock.' units left.',
                    'target_type' => 'product_variant',
                    'target_id' => $variant->id,
                    'action_url' => '/admin/inventory?variant_id='.$variant->id.'&focus=variant',
                    'created_at' => now()->toIso8601String(),
                    'meta' => [
                        'sku' => $variant->sku,
                        'stock' => (int) $variant->stock,
                    ],
                ];
            })
            ->values()
            ->all();
    }

    private function failedPaymentAlerts(): array
    {
        return Order::query()
            ->with('user')
            ->where('status', Order::STATUS_FAILED)
            ->where('created_at', '>=', now()->subDays(7))
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(fn (Order $order): array => [
                'id' => 'failed-payment-'.$order->id,
                'type' => 'failed_payment',
                'priority' => 'warning',
                'title' => 'Failed payment',
                'message' => 'Order #'.$order->id.' failed for '.($order->user?->username ?? $order->name ?? 'a customer').'.',
                'target_type' => 'order',
                'target_id' => $order->id,
                'action_url' => '/admin/orders/'.$order->id,
                'created_at' => $order->created_at?->toIso8601String() ?? now()->toIso8601String(),
                'meta' => [
                    'total_amount_mmk' => (int) $order->total_amount_mmk,
                    'payment_method' => $order->payment_method,
                ],
            ])
            ->values()
            ->all();
    }

    private function highValueOrderAlerts(): array
    {
        $threshold = 500000;

        return Order::query()
            ->with('user')
            ->where('total_amount_mmk', '>=', $threshold)
            ->whereIn('status', [Order::STATUS_PENDING, Order::STATUS_PAID])
            ->where('created_at', '>=', now()->subDays(7))
            ->orderByDesc('total_amount_mmk')
            ->limit(8)
            ->get()
            ->map(fn (Order $order): array => [
                'id' => 'high-value-order-'.$order->id,
                'type' => 'high_value_order',
                'priority' => $order->status === Order::STATUS_PENDING ? 'warning' : 'info',
                'title' => 'High-value order',
                'message' => 'Order #'.$order->id.' is worth '.number_format((int) $order->total_amount_mmk).' MMK.',
                'target_type' => 'order',
                'target_id' => $order->id,
                'action_url' => '/admin/orders/'.$order->id,
                'created_at' => $order->created_at?->toIso8601String() ?? now()->toIso8601String(),
                'meta' => [
                    'status' => $order->status,
                    'total_amount_mmk' => (int) $order->total_amount_mmk,
                    'customer' => $order->user?->username,
                ],
            ])
            ->values()
            ->all();
    }

    private function securityAlerts(): array
    {
        $sensitiveActivity = AdminActivityLog::query()
            ->with('actor')
            ->whereIn('action', ['user.role_update', 'user.status_update'])
            ->where('created_at', '>=', now()->subDays(7))
            ->orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->map(fn (AdminActivityLog $log): array => [
                'id' => 'security-'.$log->id,
                'type' => 'security_review',
                'priority' => 'critical',
                'title' => 'Sensitive admin change',
                'message' => ($log->actor?->username ?? 'An admin').' performed '.$log->action.'.',
                'target_type' => 'admin_activity_log',
                'target_id' => $log->id,
                'action_url' => '/admin/audit-logs/'.$log->id,
                'created_at' => $log->created_at?->toIso8601String() ?? now()->toIso8601String(),
                'meta' => [
                    'action' => $log->action,
                    'affected_target_type' => $log->target_type,
                    'affected_target_id' => $log->target_id,
                ],
            ]);

        $busyActors = AdminActivityLog::query()
            ->select('actor_id', DB::raw('count(*) as activity_count'), DB::raw('max(created_at) as latest_at'))
            ->whereNotNull('actor_id')
            ->where('created_at', '>=', now()->subDay())
            ->groupBy('actor_id')
            ->having('activity_count', '>=', 5)
            ->with('actor')
            ->get()
            ->map(fn (AdminActivityLog $log): array => [
                'id' => 'busy-admin-'.$log->actor_id,
                'type' => 'admin_activity_spike',
                'priority' => 'warning',
                'title' => 'Admin activity spike',
                'message' => ($log->actor?->username ?? 'An admin').' made '.$log->activity_count.' admin changes in 24 hours.',
                'target_type' => 'user',
                'target_id' => $log->actor_id,
                'action_url' => '/admin/audit-logs?actor_id='.$log->actor_id,
                'created_at' => $log->latest_at ? (string) $log->latest_at : now()->toIso8601String(),
                'meta' => [
                    'activity_count' => (int) $log->activity_count,
                ],
            ]);

        return collect($sensitiveActivity->all())
            ->merge($busyActors->all())
            ->values()
            ->all();
    }

    private function priorityRank(string $priority): int
    {
        return match ($priority) {
            'critical' => 0,
            'warning' => 1,
            default => 2,
        };
    }
}
