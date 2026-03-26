<?php

namespace App\Providers;

use App\Models\Cart;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\View;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        View::composer('*', function ($view): void {
            $cartCount = 0;

            if (Auth::check()) {
                $cartCount = Cart::query()
                    ->where('user_id', Auth::id())
                    ->withSum('items', 'quantity')
                    ->first()
                    ?->items_sum_quantity ?? 0;
            }

            $view->with('cartCount', (int) $cartCount);
        });
    }
}
