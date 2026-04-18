<?php

return [
    /*
    | Minimum lifetime credit score (MMK from completed purchases) required to apply for Shopkeeper.
    */
    'shopkeeper_credit_threshold' => (int) env('SHOPKEEPER_CREDIT_THRESHOLD', 500_000),
];
