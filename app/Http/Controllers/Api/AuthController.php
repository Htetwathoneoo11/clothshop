<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CouponService;
use App\Services\EmailVerificationCodeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Throwable;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);
        $remember = (bool) ($data['remember'] ?? false);

        $login = trim($data['username']);

        // Accept either username or email in the same login field.
        $user = User::query()
            ->where('username', $login)
            ->orWhere('email', $login)
            ->get()
            ->first(fn (User $candidate): bool => hash_equals($candidate->username, $login)
                || hash_equals($candidate->email, $login));

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Optional legacy fallback if existing users have plaintext passwords
            if ($user && $user->password === $data['password']) {
                $user->password = Hash::make($data['password']);
                $user->save();
            } else {
                return response()->json(['message' => 'Invalid credentials'], 401);
            }
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email before signing in.',
                'requires_verification' => true,
                'email' => $user->email,
            ], 403);
        }

        Auth::guard('web')->login($user, $remember);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $this->updateLoginMeta($request, $user);

        return response()->json([
            'user' => $user->fresh()->toApiArray(),
        ]);
    }//login

    public function register(Request $request, EmailVerificationCodeService $verificationCodes)
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'username' => $data['username'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => User::ROLE_USER,
            'status' => 1,
        ]);

        try {
            $verificationCodes->send($user);
        } catch (Throwable $exception) {
            Log::error('Registration verification code could not be sent.', [
                'user_id' => $user->id,
                'email' => $user->email,
                'exception' => $exception,
            ]);

            return response()->json([
                'message' => 'Your account was created, but we could not send the verification code. Please check the Mailtrap SMTP settings and request a new code.',
                'requires_verification' => true,
                'email' => $user->email,
            ], 503);
        }

        return response()->json([
            'message' => 'Registration successful. Please enter the verification code sent to your email.',
            'requires_verification' => true,
            'email' => $user->email,
        ], 201);
    }

    public function me(Request $request, CouponService $coupons)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['user' => null], 401);
        }

        $coupons->ensureCreditRewardCoupon($user);

        return response()->json([
            'user' => $user->fresh()->toApiArray(),
        ]);
    }//me

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logged out successfully.']);
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
