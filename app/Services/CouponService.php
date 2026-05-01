<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\User;

class CouponService
{
    public function ensureCreditRewardCoupon(User $user): ?Coupon
    {
        return $this->ensureCreditRewardCoupons($user)->first();
    }

    public function ensureCreditRewardCoupons(User $user)
    {
        $createdOrFound = collect();
        $creditScore = (int) $user->credit_score;

        foreach (Coupon::rewardTiers() as $tier) {
            $thresholdMmk = (int) $tier['threshold_mmk'];
            if ($creditScore < $thresholdMmk) {
                continue;
            }

            $createdOrFound->push(Coupon::query()->firstOrCreate(
                [
                    'user_id' => $user->id,
                    'threshold_mmk' => $thresholdMmk,
                ],
                [
                    'code' => $this->codeForUser($user, (int) $tier['discount_percent']),
                    'discount_percent' => (int) $tier['discount_percent'],
                ]
            ));
        }

        return $createdOrFound;
    }

    public function discountMmk(int $subtotalMmk, Coupon $coupon): int
    {
        if (! $coupon->isUsable() || $subtotalMmk <= 0) {
            return 0;
        }

        return intdiv($subtotalMmk * (int) $coupon->discount_percent, 100);
    }

    private function codeForUser(User $user, int $discountPercent): string
    {
        return 'LOYAL'.$discountPercent.'-'.$user->id;
    }
}
