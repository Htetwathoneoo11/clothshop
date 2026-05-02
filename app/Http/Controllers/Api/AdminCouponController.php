<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\User;
use App\Support\AdminAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminCouponController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $status = trim((string) $request->query('status', 'all'));
        $userId = trim((string) $request->query('user_id', 'all'));
        $sort = trim((string) $request->query('sort', 'newest'));
        $perPage = max(1, min(30, (int) $request->query('per_page', 10)));

        $coupons = Coupon::query()
            ->with(['user', 'usedOrder'])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $subQuery) use ($search): void {
                    if (ctype_digit($search)) {
                        $subQuery->where('id', (int) $search)
                            ->orWhere('used_order_id', (int) $search);
                    }

                    $subQuery->orWhere('code', 'like', '%'.$search.'%')
                        ->orWhereHas('user', function (Builder $userQuery) use ($search): void {
                            $userQuery->where('username', 'like', '%'.$search.'%')
                                ->orWhere('email', 'like', '%'.$search.'%');
                        });
                });
            })
            ->when(ctype_digit($userId), fn (Builder $query) => $query->where('user_id', (int) $userId));

        $this->applyStatusFilter($coupons, $status);
        $this->applySort($coupons, $sort);

        $paginated = $coupons->paginate($perPage)->withQueryString();

        return response()->json([
            'coupons' => collect($paginated->items())
                ->map(fn (Coupon $coupon) => $this->serializeCoupon($coupon))
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
                'status' => $status,
                'user_id' => $userId,
                'sort' => $sort,
            ],
            'reward_tiers' => Coupon::rewardTiers(),
        ]);
    }

    public function show(Coupon $coupon)
    {
        return response()->json([
            'coupon' => $this->serializeCoupon($coupon->load(['user', 'usedOrder'])),
            'reward_tiers' => Coupon::rewardTiers(),
        ]);
    }

    public function store(Request $request)
    {
        $rewardThresholds = collect(Coupon::rewardTiers())->pluck('threshold_mmk')->all();

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'threshold_mmk' => ['required', 'integer', Rule::in($rewardThresholds)],
            'discount_percent' => ['nullable', 'integer', 'min:1', 'max:90'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $user = User::query()->findOrFail((int) $validated['user_id']);
        $tier = collect(Coupon::rewardTiers())
            ->first(fn (array $candidate): bool => (int) $candidate['threshold_mmk'] === (int) $validated['threshold_mmk']);
        $discountPercent = (int) ($validated['discount_percent'] ?? $tier['discount_percent']);

        if (Coupon::query()->where('user_id', $user->id)->where('threshold_mmk', (int) $validated['threshold_mmk'])->exists()) {
            return response()->json([
                'message' => 'This user already has a coupon for that reward tier.',
            ], 422);
        }

        $coupon = Coupon::query()->create([
            'user_id' => $user->id,
            'code' => $this->generateManualCode($user, $discountPercent),
            'discount_percent' => $discountPercent,
            'threshold_mmk' => (int) $validated['threshold_mmk'],
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        AdminAudit::record(
            $request,
            'coupon.grant',
            'coupon',
            $coupon->id,
            null,
            $this->couponSnapshot($coupon->fresh(['user'])),
            ['user_id' => $user->id]
        );

        return response()->json([
            'coupon' => $this->serializeCoupon($coupon->fresh(['user', 'usedOrder'])),
        ], 201);
    }

    public function expire(Request $request, Coupon $coupon)
    {
        if ($coupon->used_at !== null) {
            return response()->json([
                'message' => 'Used coupons cannot be expired manually.',
            ], 422);
        }

        $before = $this->couponSnapshot($coupon);
        $coupon->forceFill(['expires_at' => now()->subSecond()])->save();
        $after = $this->couponSnapshot($coupon->fresh(['user']));

        AdminAudit::record(
            $request,
            'coupon.expire',
            'coupon',
            $coupon->id,
            $before,
            $after
        );

        return response()->json([
            'coupon' => $this->serializeCoupon($coupon->fresh(['user', 'usedOrder'])),
        ]);
    }

    public function reactivate(Request $request, Coupon $coupon)
    {
        if ($coupon->used_at !== null) {
            return response()->json([
                'message' => 'Used coupons cannot be reactivated.',
            ], 422);
        }

        $before = $this->couponSnapshot($coupon);
        $coupon->forceFill(['expires_at' => null])->save();
        $after = $this->couponSnapshot($coupon->fresh(['user']));

        AdminAudit::record(
            $request,
            'coupon.reactivate',
            'coupon',
            $coupon->id,
            $before,
            $after
        );

        return response()->json([
            'coupon' => $this->serializeCoupon($coupon->fresh(['user', 'usedOrder'])),
        ]);
    }

    private function serializeCoupon(Coupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'discount_percent' => (int) $coupon->discount_percent,
            'threshold_mmk' => (int) $coupon->threshold_mmk,
            'status' => $coupon->statusLabel(),
            'is_usable' => $coupon->isUsable(),
            'used_order_id' => $coupon->used_order_id,
            'used_at' => $coupon->used_at?->toIso8601String(),
            'expires_at' => $coupon->expires_at?->toIso8601String(),
            'created_at' => $coupon->created_at?->toIso8601String(),
            'updated_at' => $coupon->updated_at?->toIso8601String(),
            'user' => $coupon->user ? [
                'id' => $coupon->user->id,
                'username' => $coupon->user->username,
                'email' => $coupon->user->email,
                'credit_score' => (int) $coupon->user->credit_score,
            ] : null,
            'used_order' => $coupon->usedOrder ? [
                'id' => $coupon->usedOrder->id,
                'status' => $coupon->usedOrder->status,
                'total_amount_mmk' => (int) $coupon->usedOrder->total_amount_mmk,
            ] : null,
        ];
    }

    private function couponSnapshot(Coupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'user_id' => $coupon->user_id,
            'code' => $coupon->code,
            'discount_percent' => (int) $coupon->discount_percent,
            'threshold_mmk' => (int) $coupon->threshold_mmk,
            'status' => $coupon->statusLabel(),
            'used_order_id' => $coupon->used_order_id,
            'used_at' => $coupon->used_at?->toIso8601String(),
            'expires_at' => $coupon->expires_at?->toIso8601String(),
        ];
    }

    private function generateManualCode(User $user, int $discountPercent): string
    {
        do {
            $code = 'ADMIN'.$discountPercent.'-'.$user->id.'-'.Str::upper(Str::random(6));
        } while (Coupon::query()->where('code', $code)->exists());

        return $code;
    }

    private function applyStatusFilter(Builder $query, string $status): void
    {
        if ($status === 'available') {
            $query->whereNull('used_at')
                ->where(function (Builder $subQuery): void {
                    $subQuery->whereNull('expires_at')
                        ->orWhere('expires_at', '>', now());
                });
            return;
        }

        if ($status === 'used') {
            $query->whereNotNull('used_at');
            return;
        }

        if ($status === 'expired') {
            $query->whereNull('used_at')
                ->whereNotNull('expires_at')
                ->where('expires_at', '<=', now());
        }
    }

    private function applySort(Builder $query, string $sort): void
    {
        if ($sort === 'oldest') {
            $query->orderBy('id');
            return;
        }

        if ($sort === 'threshold_desc') {
            $query->orderByDesc('threshold_mmk')->orderByDesc('id');
            return;
        }

        if ($sort === 'discount_desc') {
            $query->orderByDesc('discount_percent')->orderByDesc('id');
            return;
        }

        $query->orderByDesc('id');
    }
}
