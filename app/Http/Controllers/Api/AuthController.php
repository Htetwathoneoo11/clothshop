<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $login = trim($data['username']);

        // Accept either username or email in the same login field.
        $user = User::query()
            ->where('username', $login)
            ->orWhere('email', $login)
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Optional legacy fallback if existing users have plaintext passwords
            if ($user && $user->password === $data['password']) {
                $user->password = Hash::make($data['password']);
                $user->save();
            } else {
                return response()->json(['message' => 'Invalid credentials'], 401);
            }
        }

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $this->updateLoginMeta($request, $user);

        return response()->json([
            'user' => $this->userPayload($user->fresh()),
        ]);
    }//login

    public function register(Request $request)
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
            'role' => 1,
            'status' => 1,
        ]);

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $this->updateLoginMeta($request, $user);

        return response()->json([
            'message' => 'Registration successful.',
            'user' => $this->userPayload($user->fresh()),
        ], 201);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['user' => null], 401);
        }

        return response()->json([
            'user' => $this->userPayload($user),
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

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role,
            'status' => $user->status,
            'last_login_at' => $user->last_login_at,
            'last_login_ip' => $user->last_login_ip,
            'user_agent' => $user->user_agent,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}
