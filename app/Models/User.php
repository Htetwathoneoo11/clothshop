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
        'credit_score' => 'integer',
        // 'password' => 'hashed',
    ];

    public function isAdmin(): bool
    {
        return (int) $this->role === self::ROLE_ADMIN;
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
