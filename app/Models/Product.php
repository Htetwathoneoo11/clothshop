<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category',
        'brand',
        'description',
        'image_url',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function cartItems(): HasManyThrough
    {
        return $this->hasManyThrough(
            CartItem::class,
            ProductVariant::class,
            'product_id',
            'product_variant_id',
            'id',
            'id'
        );
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }
}
