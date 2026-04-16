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

    public const ALLOWED_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PAID,
        self::STATUS_FAILED,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'user_id',
        'total_amount',
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
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
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
}
