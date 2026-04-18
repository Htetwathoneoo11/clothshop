<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopkeeperApplicationController extends Controller
{
    public function apply(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $threshold = (int) config('commerce.shopkeeper_credit_threshold');

        if ($user->isShopkeeper()) {
            return response()->json([
                'message' => 'You already have the Shopkeeper role.',
                'user' => $user->fresh()->toApiArray(),
                'threshold' => $threshold,
                'eligible' => false,
                'remaining_credit' => 0,
            ]);
        }

        $score = (int) $user->credit_score;

        if ($score < $threshold) {
            $remaining = $threshold - $score;

            return response()->json([
                'message' => 'Your credit score is not high enough to apply yet.',
                'threshold' => $threshold,
                'eligible' => false,
                'remaining_credit' => $remaining,
            ], 422);
        }

        $user->role = User::ROLE_SHOPKEEPER;
        $user->save();

        return response()->json([
            'message' => 'Congratulations! You are now a Shopkeeper.',
            'user' => $user->fresh()->toApiArray(),
            'threshold' => $threshold,
            'eligible' => true,
            'remaining_credit' => 0,
        ]);
    }
}
