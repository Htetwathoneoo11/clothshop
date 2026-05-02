<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_USER = 1;

    public const ROLE_ADMIN = 2;

    public const ROLE_MANAGER = 3;

    public const ROLE_SUPPORT = 4;

    public const ROLE_INVENTORY_ADMIN = 5;

    public const ADMIN_ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_MANAGER,
        self::ROLE_SUPPORT,
        self::ROLE_INVENTORY_ADMIN,
    ];

    public const ROLE_LABELS = [
        self::ROLE_USER => 'User',
        self::ROLE_ADMIN => 'Super Admin',
        self::ROLE_MANAGER => 'Manager',
        self::ROLE_SUPPORT => 'Support',
        self::ROLE_INVENTORY_ADMIN => 'Inventory Admin',
    ];

    public const ROLE_SLUGS = [
        self::ROLE_USER => 'user',
        self::ROLE_ADMIN => 'super_admin',
        self::ROLE_MANAGER => 'manager',
        self::ROLE_SUPPORT => 'support',
        self::ROLE_INVENTORY_ADMIN => 'inventory_admin',
    ];

    public const ADMIN_PERMISSION_ROLES = [
        'manage_users' => [self::ROLE_ADMIN],
        'manage_orders' => [self::ROLE_ADMIN, self::ROLE_MANAGER, self::ROLE_SUPPORT],
        'manage_catalog' => [self::ROLE_ADMIN, self::ROLE_MANAGER, self::ROLE_INVENTORY_ADMIN],
        'manage_inventory' => [self::ROLE_ADMIN, self::ROLE_MANAGER, self::ROLE_INVENTORY_ADMIN],
        'manage_marketing' => [self::ROLE_ADMIN, self::ROLE_MANAGER],
        'manage_loyalty' => [self::ROLE_ADMIN, self::ROLE_MANAGER],
        'view_audit' => [self::ROLE_ADMIN],
        'view_reports' => [self::ROLE_ADMIN, self::ROLE_MANAGER, self::ROLE_INVENTORY_ADMIN],
        'view_notifications' => [self::ROLE_ADMIN, self::ROLE_MANAGER, self::ROLE_SUPPORT, self::ROLE_INVENTORY_ADMIN],
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'username',
        'email',
        'password',
        'role',
        'status',
        'avatar_path',
        'credit_score',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
        'role' => 'integer',
        'status' => 'integer',
        'credit_score' => 'integer',
        // 'password' => 'hashed',
    ];

    public function isAdmin(): bool
    {
        return in_array((int) $this->role, self::ADMIN_ROLES, true);
    }

    public function isSuperAdmin(): bool
    {
        return (int) $this->role === self::ROLE_ADMIN;
    }

    public function roleLabel(): string
    {
        return self::ROLE_LABELS[(int) $this->role] ?? 'User';
    }

    public function roleSlug(): string
    {
        return self::ROLE_SLUGS[(int) $this->role] ?? 'user';
    }

    public function hasAdminPermission(string $permission): bool
    {
        return in_array((int) $this->role, self::ADMIN_PERMISSION_ROLES[$permission] ?? [], true);
    }

    public function adminPermissions(): array
    {
        $permissions = ['access_admin' => $this->isAdmin()];

        foreach (self::ADMIN_PERMISSION_ROLES as $permission => $roles) {
            $permissions[$permission] = in_array((int) $this->role, $roles, true);
        }

        return $permissions;
    }

    public function cart(): HasOne
    {
        return $this->hasOne(Cart::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function coupons(): HasMany
    {
        return $this->hasMany(Coupon::class);
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar_path) {
            return null;
        }

        return Storage::disk('public')->url($this->avatar_path);
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function toApiArray(): array
    {
        $creditScore = (int) $this->credit_score;
        $nextTier = Coupon::nextTierForCredit($creditScore);
        $activeCoupons = $this->coupons()
            ->orderBy('threshold_mmk')
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (Coupon $coupon): bool => $coupon->isUsable())
            ->values();
        $activeCoupon = $activeCoupons->first();
        $couponHistory = $this->coupons()
            ->orderByDesc('threshold_mmk')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Coupon $coupon): array => $this->couponToApiArray($coupon, true))
            ->values()
            ->all();
        $displayThreshold = $nextTier
            ? (int) $nextTier['threshold_mmk']
            : (int) collect(Coupon::rewardTiers())->max('threshold_mmk');

        return [
            'id' => $this->id,
            'username' => $this->username,
            'email' => $this->email,
            'role' => $this->role,
            'is_admin' => $this->isAdmin(),
            'admin_role' => $this->roleSlug(),
            'role_label' => $this->roleLabel(),
            'permissions' => $this->adminPermissions(),
            'status' => $this->status,
            'credit_score' => $creditScore,
            'loyalty' => [
                'threshold_mmk' => $displayThreshold,
                'remaining_mmk' => $nextTier ? max(0, (int) $nextTier['threshold_mmk'] - $creditScore) : 0,
                'progress_percent' => min(100, (int) floor(($creditScore / max(1, $displayThreshold)) * 100)),
                'reward_unlocked' => $activeCoupons->isNotEmpty(),
                'coupon' => $activeCoupon ? $this->couponToApiArray($activeCoupon) : null,
                'coupons' => $activeCoupons->map(fn (Coupon $coupon): array => $this->couponToApiArray($coupon))->all(),
                'coupon_history' => $couponHistory,
                'tiers' => Coupon::rewardTiers(),
                'next_reward' => $nextTier,
            ],
            'email_verified_at' => $this->email_verified_at,
            'has_verified_email' => $this->hasVerifiedEmail(),
            'avatar_url' => $this->avatar_url,
            'last_login_at' => $this->last_login_at,
            'last_login_ip' => $this->last_login_ip,
            'user_agent' => $this->user_agent,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    private function couponToApiArray(Coupon $coupon, bool $includeStatus = false): array
    {
        $payload = [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'discount_percent' => (int) $coupon->discount_percent,
            'threshold_mmk' => (int) $coupon->threshold_mmk,
            'used_at' => $coupon->used_at?->toIso8601String(),
            'used_order_id' => $coupon->used_order_id,
            'expires_at' => $coupon->expires_at?->toIso8601String(),
        ];

        if ($includeStatus) {
            $payload['status'] = $coupon->statusLabel();
        }

        return $payload;
    }
}
