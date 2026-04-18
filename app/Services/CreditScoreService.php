<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreditScoreService
{
    /**
     * Award credit for a paid order exactly once (idempotent).
     * Call inside an existing DB transaction; uses row locks.
     */
    public function awardForPaidOrder(Order $order): void
    {
        if ($order->status !== Order::STATUS_PAID) {
            return;
        }

        $orderId = $order->getKey();
        if ($orderId === null) {
            return;
        }

        $locked = Order::query()
            ->whereKey($orderId)
            ->lockForUpdate()
            ->first();

        if ($locked === null || $locked->credit_awarded_at !== null) {
            return;
        }

        $amountMmk = (int) $locked->total_amount_mmk;

        if ($amountMmk > 0) {
            User::query()
                ->whereKey($locked->user_id)
                ->lockForUpdate()
                ->increment('credit_score', $amountMmk);
        }

        $locked->forceFill(['credit_awarded_at' => now()])->save();
    }
}
