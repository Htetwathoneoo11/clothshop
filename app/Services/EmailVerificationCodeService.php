<?php

namespace App\Services;

use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\VerifyEmailCodeNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class EmailVerificationCodeService
{
    public const EXPIRES_MINUTES = 10;

    public function send(User $user): void
    {
        EmailVerificationCode::query()
            ->where('user_id', $user->id)
            ->delete();

        $code = (string) random_int(100000, 999999);
        $expiresAt = Carbon::now()->addMinutes(self::EXPIRES_MINUTES);

        EmailVerificationCode::query()->create([
            'user_id' => $user->id,
            'email' => $user->email,
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => $expiresAt,
        ]);

        $user->notify(new VerifyEmailCodeNotification($code, $expiresAt));
    }
}
