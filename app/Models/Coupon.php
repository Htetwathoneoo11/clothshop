<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Coupon extends Model
{
    use HasFactory;

    public const CREDIT_THRESHOLD_MMK = 500000;
    public const DISCOUNT_PERCENT = 10;
    public const REWARD_TIERS = [
        ['threshold_mmk' => 500000, 'discount_percent' => 10, 'label' => 'Starter reward'],
        ['threshold_mmk' => 1000000, 'discount_percent' => 15, 'label' => 'Loyal reward'],
        ['threshold_mmk' => 2000000, 'discount_percent' => 20, 'label' => 'VIP reward'],
    ];

    protected $fillable = [
        'user_id',
        'code',
        'discount_percent',
        'threshold_mmk',
        'used_at',
        'used_order_id',
        'expires_at',
    ];

    protected $casts = [
        'discount_percent' => 'integer',
        'threshold_mmk' => 'integer',
        'used_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function usedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'used_order_id');
    }

    public function isUsable(): bool
    {
        return $this->used_at === null
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function statusLabel(): string
    {
        if ($this->used_at !== null) {
            return 'used';
        }

        if ($this->expires_at !== null && $this->expires_at->isPast()) {
            return 'expired';
        }

        return 'available';
    }

    public static function rewardTiers(): array
    {
        return self::REWARD_TIERS;
    }

    public static function nextTierForCredit(int $creditScore): ?array
    {
        foreach (self::rewardTiers() as $tier) {
            if ($creditScore < (int) $tier['threshold_mmk']) {
                return $tier;
            }
        }

        return null;
    }
}
