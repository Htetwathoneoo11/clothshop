<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffInvitation extends Model
{
    use HasFactory;

    public const INVITABLE_ROLES = [
        User::ROLE_MANAGER,
        User::ROLE_SUPPORT,
        User::ROLE_INVENTORY_ADMIN,
    ];

    protected $fillable = [
        'email',
        'username',
        'role',
        'token_hash',
        'invited_by',
        'accepted_user_id',
        'expires_at',
        'accepted_at',
        'cancelled_at',
    ];

    protected $casts = [
        'role' => 'integer',
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function acceptedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_user_id');
    }

    public function statusLabel(): string
    {
        if ($this->accepted_at) {
            return 'accepted';
        }

        if ($this->cancelled_at) {
            return 'cancelled';
        }

        if ($this->expires_at->isPast()) {
            return 'expired';
        }

        return 'pending';
    }

    public function isPending(): bool
    {
        return $this->statusLabel() === 'pending';
    }
}
