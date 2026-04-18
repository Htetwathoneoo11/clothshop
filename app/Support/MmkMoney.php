<?php

namespace App\Support;

/**
 * Integer MMK (kyat) helpers. Legacy USD decimal fields use config money.mmk_per_usd for display/backfill only.
 */
class MmkMoney
{
    public static function mmkPerUsd(): int
    {
        return max(1, (int) config('money.mmk_per_usd', 2100));
    }

    public static function usdDecimalToMmk(float|string|int $usd): int
    {
        return (int) round((float) $usd * self::mmkPerUsd());
    }

    public static function lineTotalMmk(int $quantity, int $unitPriceMmk): int
    {
        return $quantity * $unitPriceMmk;
    }

    /**
     * Legacy API fields: 2-decimal USD string derived from integer MMK (transition only).
     */
    public static function mmkToUsdDecimalString(int $mmk): string
    {
        $rate = self::mmkPerUsd();

        return number_format($mmk / $rate, 2, '.', '');
    }
}
