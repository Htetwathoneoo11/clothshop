<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryAdjustment extends Model
{
    use HasFactory;

    public const REASONS = [
        'restock',
        'correction',
        'damage',
        'return',
        'manual',
    ];

    protected $fillable = [
        'product_variant_id',
        'actor_id',
        'previous_stock',
        'adjustment',
        'new_stock',
        'reason',
        'note',
    ];

    protected $casts = [
        'previous_stock' => 'integer',
        'adjustment' => 'integer',
        'new_stock' => 'integer',
    ];

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
