<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function updateAvatar(Request $request)
    {
        $request->validate([
            'avatar' => ['required', 'image', 'max:4500'],
        ]);

        $user = $request->user();
        $file = $request->file('avatar');

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $extension = $file->guessExtension() ?: 'jpg';
        $path = $file->storeAs('avatars', $user->id.'-'.uniqid('', true).'.'.$extension, 'public');

        $user->forceFill(['avatar_path' => $path])->save();

        return response()->json([
            'user' => $user->fresh()->toApiArray(),
        ]);
    }

    public function destroyAvatar(Request $request)
    {
        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
        }

        return response()->json([
            'user' => $user->fresh()->toApiArray(),
        ]);
    }
}
