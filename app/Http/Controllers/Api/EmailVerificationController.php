<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailVerificationCode;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use App\Services\EmailVerificationCodeService;
use Throwable;

class EmailVerificationController extends Controller
{
    public function verifyCode(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
        ]);

        $user = $this->findExactEmailUser($validated['email']);
        if (! $user) {
            return $this->invalidCodeResponse();
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'This email is already verified. Please sign in.',
            ], 409);
        }

        $record = EmailVerificationCode::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        if (! $record || $record->expires_at->isPast() || $record->attempts >= 5) {
            return $this->invalidCodeResponse();
        }

        if (! Hash::check($validated['code'], $record->code_hash)) {
            $record->increment('attempts');

            return $this->invalidCodeResponse();
        }

        $user->markEmailAsVerified();
        event(new Verified($user));
        EmailVerificationCode::query()->where('user_id', $user->id)->delete();

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $this->updateLoginMeta($request, $user);

        return response()->json([
            'message' => 'Your email has been verified.',
            'user' => $user->fresh()->toApiArray(),
        ]);
    }

    public function resendCode(Request $request, EmailVerificationCodeService $verificationCodes)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = $this->findExactEmailUser($validated['email']);
        if (! $user || $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'If an unverified account exists for that email, a new code has been sent.',
            ]);
        }

        try {
            $verificationCodes->send($user);
        } catch (Throwable $exception) {
            Log::error('Email verification message could not be sent.', [
                'user_id' => $user->id,
                'email' => $user->email,
                'exception' => $exception,
            ]);

            return response()->json([
                'message' => 'We could not send the verification email. Please check the Mailtrap SMTP settings and try again.',
            ], 503);
        }

        return response()->json([
            'message' => 'Verification code sent.',
        ]);
    }

    private function findExactEmailUser(string $email): ?User
    {
        return User::query()
            ->where('email', $email)
            ->get()
            ->first(fn (User $candidate): bool => hash_equals($candidate->email, $email));
    }

    private function invalidCodeResponse()
    {
        return response()->json([
            'message' => 'This verification code is invalid or has expired.',
        ], 422);
    }

    private function updateLoginMeta(Request $request, User $user): void
    {
        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 1000),
        ])->save();
    }
}
