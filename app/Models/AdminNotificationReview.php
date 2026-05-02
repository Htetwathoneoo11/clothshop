<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminNotificationReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'notification_id',
        'reviewed_by',
        'type',
        'priority',
        'title',
        'target_type',
        'target_id',
        'snapshot',
        'reviewed_at',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
