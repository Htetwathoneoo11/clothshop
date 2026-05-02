<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\AdminNotificationReview;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\StaffInvitation;
use App\Models\User;
use App\Support\AdminAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $role = trim((string) $request->query('role', 'all'));
        $status = trim((string) $request->query('status', 'all'));
        $sort = trim((string) $request->query('sort', 'newest'));
        $perPage = max(1, min(30, (int) $request->query('per_page', 10)));

        $users = User::query()
            ->withCount(['orders', 'coupons'])
            ->withSum(['orders as paid_spend_mmk' => fn (Builder $query) => $query->where('status', Order::STATUS_PAID)], 'total_amount_mmk')
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $subQuery) use ($search): void {
                    if (ctype_digit($search)) {
                        $subQuery->where('id', (int) $search);
                    }

                    $subQuery->orWhere('username', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%')
                        ->orWhere('last_login_ip', 'like', '%'.$search.'%');
                });
            })
            ->when($role === 'user', fn (Builder $query) => $query->where('role', User::ROLE_USER))
            ->when($role === 'admin', fn (Builder $query) => $query->whereIn('role', User::ADMIN_ROLES))
            ->when($role === 'super_admin', fn (Builder $query) => $query->where('role', User::ROLE_ADMIN))
            ->when($role === 'manager', fn (Builder $query) => $query->where('role', User::ROLE_MANAGER))
            ->when($role === 'support', fn (Builder $query) => $query->where('role', User::ROLE_SUPPORT))
            ->when($role === 'inventory_admin', fn (Builder $query) => $query->where('role', User::ROLE_INVENTORY_ADMIN))
            ->when($status === 'active', fn (Builder $query) => $query->where('status', 1))
            ->when($status === 'restricted', fn (Builder $query) => $query->where('status', '!=', 1));

        $this->applySort($users, $sort);

        $paginated = $users->paginate($perPage)->withQueryString();

        return response()->json([
            'users' => collect($paginated->items())
                ->map(fn (User $user) => $this->serializeUserSummary($user))
                ->values()
                ->all(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
            'filters' => [
                'q' => $search,
                'role' => $role,
                'status' => $status,
                'sort' => $sort,
            ],
            'role_matrix' => $this->serializeRoleMatrix(),
        ]);
    }

    public function show(User $user)
    {
        $user->load([
            'orders' => fn ($query) => $query->with('items.variant.product')->orderByDesc('created_at')->limit(8),
            'coupons' => fn ($query) => $query->orderByDesc('threshold_mmk')->orderByDesc('created_at'),
        ]);
        $user->loadCount(['orders', 'coupons']);
        $user->loadSum(['orders as paid_spend_mmk' => fn (Builder $query) => $query->where('status', Order::STATUS_PAID)], 'total_amount_mmk');

        return response()->json([
            'user' => $this->serializeUserDetail($user),
            'role_matrix' => $this->serializeRoleMatrix(),
        ]);
    }

    public function updateStatus(Request $request, User $user)
    {
        if ((int) $request->user()->id === (int) $user->id) {
            return response()->json([
                'message' => 'You cannot change your own account status from admin user management.',
            ], 422);
        }

        $validated = $request->validate([
            'status' => ['required', 'integer', Rule::in([0, 1])],
        ]);

        $before = $this->userSnapshot($user);
        $user->forceFill(['status' => (int) $validated['status']])->save();
        $after = $this->userSnapshot($user->fresh());

        AdminAudit::record(
            $request,
            'user.status_update',
            'user',
            $user->id,
            $before,
            $after
        );

        return response()->json([
            'user' => $this->serializeUserDetail($user->fresh()),
        ]);
    }

    public function updateRole(Request $request, User $user)
    {
        if ((int) $request->user()->id === (int) $user->id) {
            return response()->json([
                'message' => 'You cannot change your own role from admin user management.',
            ], 422);
        }

        $validated = $request->validate([
            'role' => ['required', 'integer', Rule::in(array_keys(User::ROLE_LABELS))],
        ]);

        $before = $this->userSnapshot($user);
        $user->forceFill(['role' => (int) $validated['role']])->save();
        $after = $this->userSnapshot($user->fresh());

        AdminAudit::record(
            $request,
            'user.role_update',
            'user',
            $user->id,
            $before,
            $after
        );

        return response()->json([
            'user' => $this->serializeUserDetail($user->fresh()),
        ]);
    }

    private function serializeUserSummary(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role' => (int) $user->role,
            'is_admin' => $user->isAdmin(),
            'admin_role' => $user->roleSlug(),
            'role_label' => $user->roleLabel(),
            'permissions' => $user->adminPermissions(),
            'status' => (int) $user->status,
            'status_label' => (int) $user->status === 1 ? 'Active' : 'Restricted',
            'credit_score' => (int) $user->credit_score,
            'orders_count' => (int) ($user->orders_count ?? 0),
            'coupons_count' => (int) ($user->coupons_count ?? 0),
            'paid_spend_mmk' => (int) ($user->paid_spend_mmk ?? 0),
            'has_verified_email' => $user->hasVerifiedEmail(),
            'avatar_url' => $user->avatar_url,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'last_login_ip' => $user->last_login_ip,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    private function serializeUserDetail(User $user): array
    {
        $summary = $this->serializeUserSummary($user);

        $summary['orders'] = $user->orders
            ->map(fn (Order $order) => $this->serializeOrder($order))
            ->values()
            ->all();
        $summary['coupons'] = $user->coupons
            ->map(fn (Coupon $coupon) => $this->serializeCoupon($coupon))
            ->values()
            ->all();
        $summary['email_verified_at'] = $user->email_verified_at?->toIso8601String();
        $summary['user_agent'] = $user->user_agent;
        $summary['timeline'] = $this->serializeUserTimeline($user);

        return $summary;
    }

    private function serializeUserTimeline(User $user): array
    {
        $auditLogs = AdminActivityLog::query()
            ->with('actor')
            ->where(function (Builder $query) use ($user): void {
                $query->where('actor_id', $user->id)
                    ->orWhere(function (Builder $targetQuery) use ($user): void {
                        $targetQuery->where('target_type', 'user')
                            ->where('target_id', $user->id);
                    })
                    ->orWhere('meta->user_id', $user->id);
            })
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn (AdminActivityLog $log): array => $this->serializeAuditTimelineItem($log, $user));

        $invitations = StaffInvitation::query()
            ->with(['inviter', 'acceptedUser'])
            ->where(function (Builder $query) use ($user): void {
                $query->where('invited_by', $user->id)
                    ->orWhere('accepted_user_id', $user->id)
                    ->orWhere('email', $user->email)
                    ->orWhere('username', $user->username);
            })
            ->orderByDesc('created_at')
            ->limit(12)
            ->get()
            ->map(fn (StaffInvitation $invitation): array => $this->serializeInvitationTimelineItem($invitation, $user));

        $notificationReviews = AdminNotificationReview::query()
            ->with('reviewer')
            ->where(function (Builder $query) use ($user): void {
                $query->where('reviewed_by', $user->id)
                    ->orWhere(function (Builder $targetQuery) use ($user): void {
                        $targetQuery->where('target_type', 'user')
                            ->where('target_id', $user->id);
                    });
            })
            ->orderByDesc('reviewed_at')
            ->limit(12)
            ->get()
            ->map(fn (AdminNotificationReview $review): array => $this->serializeNotificationReviewTimelineItem($review, $user));

        return $auditLogs
            ->merge($invitations)
            ->merge($notificationReviews)
            ->sortByDesc(fn (array $item): int => strtotime((string) $item['created_at']) ?: 0)
            ->values()
            ->take(24)
            ->all();
    }

    private function serializeAuditTimelineItem(AdminActivityLog $log, User $user): array
    {
        $after = $log->after_state ?? [];
        $before = $log->before_state ?? [];
        $isActor = (int) $log->actor_id === (int) $user->id;
        $isTargetUser = $log->target_type === 'user' && (int) $log->target_id === (int) $user->id;

        $title = match ($log->action) {
            'user.role_update' => 'Role changed',
            'user.status_update' => 'Status changed',
            'staff_invitation.create' => 'Staff invitation created',
            'staff_invitation.cancel' => 'Staff invitation cancelled',
            'coupon.grant' => 'Coupon granted',
            'coupon.expire' => 'Coupon expired',
            'coupon.reactivate' => 'Coupon reactivated',
            'inventory.adjust' => 'Inventory adjusted',
            default => str_replace(['.', '_'], [' ', ' '], $log->action),
        };

        $description = $isActor && ! $isTargetUser
            ? 'Performed '.$log->action.' on '.$log->target_type.' #'.($log->target_id ?? '-').'.'
            : 'Updated by '.($log->actor?->username ?? 'System').'.';

        if ($log->action === 'user.role_update' && isset($after['role'])) {
            $description = 'Role changed from '.($before['role'] ?? '-').' to '.(User::ROLE_LABELS[(int) $after['role']] ?? $after['role']).'.';
        }

        if ($log->action === 'user.status_update' && isset($after['status'])) {
            $description = 'Status changed to '.((int) $after['status'] === 1 ? 'active' : 'restricted').'.';
        }

        if (str_starts_with($log->action, 'coupon.') && isset($after['code'])) {
            $description = 'Coupon '.$after['code'].' for '.number_format((int) ($after['threshold_mmk'] ?? 0)).' MMK.';
        }

        if ($log->action === 'inventory.adjust' && isset($after['adjustment'])) {
            $description = 'Stock changed by '.(int) $after['adjustment'].' for product variant #'.$log->target_id.'.';
        }

        return [
            'id' => 'audit-'.$log->id,
            'source' => 'audit',
            'title' => $title,
            'description' => $description,
            'action' => $log->action,
            'target_type' => $log->target_type,
            'target_id' => $log->target_id,
            'created_at' => $log->created_at?->toIso8601String(),
            'action_url' => '/admin/audit-logs/'.$log->id,
            'actor' => $this->serializeActor($log->actor),
        ];
    }

    private function serializeInvitationTimelineItem(StaffInvitation $invitation, User $user): array
    {
        $isInviter = (int) $invitation->invited_by === (int) $user->id;
        $status = $invitation->statusLabel();

        return [
            'id' => 'staff-invitation-'.$invitation->id,
            'source' => 'staff_invitation',
            'title' => $isInviter ? 'Sent staff invitation' : 'Received staff invitation',
            'description' => $invitation->email.' as '.(User::ROLE_LABELS[(int) $invitation->role] ?? 'Admin').' is '.$status.'.',
            'action' => 'staff_invitation.'.$status,
            'target_type' => 'staff_invitation',
            'target_id' => $invitation->id,
            'created_at' => ($invitation->accepted_at ?? $invitation->cancelled_at ?? $invitation->created_at)?->toIso8601String(),
            'action_url' => '/admin/users/'.$user->id,
            'actor' => $this->serializeActor($invitation->inviter),
        ];
    }

    private function serializeNotificationReviewTimelineItem(AdminNotificationReview $review, User $user): array
    {
        $isReviewer = (int) $review->reviewed_by === (int) $user->id;

        return [
            'id' => 'notification-review-'.$review->id,
            'source' => 'notification_review',
            'title' => $isReviewer ? 'Reviewed notification' : 'Notification reviewed',
            'description' => $review->title.' was marked reviewed.',
            'action' => 'notification.review',
            'target_type' => $review->target_type,
            'target_id' => $review->target_id,
            'created_at' => $review->reviewed_at?->toIso8601String(),
            'action_url' => $review->snapshot['action_url'] ?? '/admin/notifications',
            'actor' => $this->serializeActor($review->reviewer),
        ];
    }

    private function serializeActor(?User $actor): ?array
    {
        if (! $actor) {
            return null;
        }

        return [
            'id' => $actor->id,
            'username' => $actor->username,
            'email' => $actor->email,
        ];
    }

    private function serializeRoleMatrix(): array
    {
        $permissionLabels = [
            'manage_users' => 'Users and staff',
            'manage_orders' => 'Orders',
            'manage_catalog' => 'Catalog',
            'manage_inventory' => 'Inventory',
            'manage_marketing' => 'Marketing boards',
            'manage_loyalty' => 'Coupons and loyalty',
            'view_audit' => 'Audit logs',
            'view_reports' => 'Reports',
            'view_notifications' => 'Notifications',
        ];

        return [
            'permissions' => collect(User::ADMIN_PERMISSION_ROLES)
                ->keys()
                ->map(fn (string $permission): array => [
                    'key' => $permission,
                    'label' => $permissionLabels[$permission] ?? str_replace('_', ' ', $permission),
                ])
                ->values()
                ->all(),
            'roles' => collect(User::ADMIN_ROLES)
                ->map(fn (int $role): array => [
                    'role' => $role,
                    'slug' => User::ROLE_SLUGS[$role] ?? 'admin',
                    'label' => User::ROLE_LABELS[$role] ?? 'Admin',
                    'permissions' => collect(User::ADMIN_PERMISSION_ROLES)
                        ->mapWithKeys(fn (array $roles, string $permission): array => [
                            $permission => in_array($role, $roles, true),
                        ])
                        ->all(),
                ])
                ->values()
                ->all(),
        ];
    }

    private function serializeOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'status' => $order->status,
            'total_amount_mmk' => (int) $order->total_amount_mmk,
            'discount_mmk' => (int) $order->discount_mmk,
            'payment_method' => $order->payment_method,
            'created_at' => $order->created_at?->toIso8601String(),
            'paid_at' => $order->paid_at?->toIso8601String(),
            'items_count' => $order->items->sum('quantity'),
            'items' => $order->items->map(function ($item) {
                $variant = $item->variant;
                $product = $variant?->product;

                return [
                    'quantity' => (int) $item->quantity,
                    'line_total_mmk' => (int) $item->line_total_mmk,
                    'product_name' => $product?->name ?? 'Product',
                    'color' => $variant?->color,
                    'size' => $variant?->size,
                ];
            })->values()->all(),
        ];
    }

    private function serializeCoupon(Coupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'discount_percent' => (int) $coupon->discount_percent,
            'threshold_mmk' => (int) $coupon->threshold_mmk,
            'status' => $coupon->statusLabel(),
            'used_order_id' => $coupon->used_order_id,
            'used_at' => $coupon->used_at?->toIso8601String(),
            'expires_at' => $coupon->expires_at?->toIso8601String(),
            'created_at' => $coupon->created_at?->toIso8601String(),
        ];
    }

    private function userSnapshot(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role' => (int) $user->role,
            'status' => (int) $user->status,
            'credit_score' => (int) $user->credit_score,
        ];
    }

    private function applySort(Builder $query, string $sort): void
    {
        if ($sort === 'oldest') {
            $query->orderBy('id');
            return;
        }

        if ($sort === 'username_asc') {
            $query->orderBy('username')->orderByDesc('id');
            return;
        }

        if ($sort === 'credit_desc') {
            $query->orderByDesc('credit_score')->orderByDesc('id');
            return;
        }

        if ($sort === 'spend_desc') {
            $query->orderByDesc('paid_spend_mmk')->orderByDesc('id');
            return;
        }

        if ($sort === 'orders_desc') {
            $query->orderByDesc('orders_count')->orderByDesc('id');
            return;
        }

        $query->orderByDesc('id');
    }
}
