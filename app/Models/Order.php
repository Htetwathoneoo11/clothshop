<?php

namespace App\Models;

use InvalidArgumentException;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    public const PAYMENT_CASH_ON_DELIVERY = 'cash_on_delivery';
    public const PAYMENT_CARD_ON_DELIVERY = 'card_on_delivery';
    public const PAYMENT_STRIPE_CHECKOUT = 'stripe_checkout';

    public const ALLOWED_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PAID,
        self::STATUS_FAILED,
        self::STATUS_CANCELLED,
    ];

    public const ONLINE_PAYMENT_METHODS = [
        self::PAYMENT_STRIPE_CHECKOUT,
    ];

    protected $fillable = [
        'user_id',
        'total_amount',
        'total_amount_mmk',
        'status',
        'name',
        'phone_number',
        'delivery_date',
        'delivery_time',
        'building_or_flat',
        'street_or_road',
        'township',
        'city',
        'payment_method',
        'coupon_code',
        'coupon_discount_percent',
        'discount_mmk',
        'stripe_checkout_session_id',
        'stripe_payment_intent_id',
        'paid_at',
        'credit_awarded_at',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'total_amount_mmk' => 'integer',
        'coupon_discount_percent' => 'integer',
        'discount_mmk' => 'integer',
        'paid_at' => 'datetime',
        'credit_awarded_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (Order $order): void {
            if (! in_array((string) $order->status, self::ALLOWED_STATUSES, true)) {
                throw new InvalidArgumentException('Invalid order status.');
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function isCreditAwarded(): bool
    {
        return $this->credit_awarded_at !== null;
    }
}
