<?php

return [
    /*
    | Legacy USD-equivalent prices were stored as decimals; MMK backfill uses this rate.
    | TODO: remove after all consumers use integer MMK columns only.
    */
    'mmk_per_usd' => (int) env('MMK_PER_USD', 2100),
];
