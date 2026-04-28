<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Throwable;

class PasswordResetController extends Controller
{
    public function sendResetLink(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        try {
            $status = Password::sendResetLink([
                'email' => $validated['email'],
            ]);
        } catch (Throwable $exception) {
            Log::error('Password reset email could not be sent.', [
                'email' => $validated['email'],
                'exception' => $exception,
            ]);

            return response()->json([
                'message' => 'We could not send the reset email. Please check the Mailtrap SMTP settings and try again.',
            ], 503);
        }

        if ($status === Password::RESET_THROTTLED) {
            Log::info('Password reset email request throttled.', [
                'email' => $validated['email'],
            ]);
        }

        return response()->json([
            'message' => 'If an account exists for that email, a reset link has been sent.',
        ]);
    }

    public function reset(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            $validated,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'This password reset link is invalid or has expired.',
            ], 422);
        }

        return response()->json([
            'message' => 'Your password has been reset. You can now sign in.',
        ]);
    }

    public function validateToken(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();
        $isValid = $user
            ? Password::getRepository()->exists($user, $validated['token'])
            : false;

        if (! $isValid) {
            return response()->json([
                'valid' => false,
                'message' => 'This reset link has already been used or has expired. Please request a new one.',
            ], 422);
        }

        return response()->json([
            'valid' => true,
            'message' => 'This reset link is ready to use.',
        ]);
    }
}
