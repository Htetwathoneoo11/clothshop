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

        $user = User::where('username', $data['username'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Optional legacy fallback if existing users have plaintext passwords
            if ($user && $user->password === $data['password']) {
                $user->password = Hash::make($data['password']);
                $user->save();
            } else {
                return response()->json(['message' => 'Invalid credentials'], 401);
            }
        }

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json([
            'user' => [
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
            ],
        ]);
    }
}
