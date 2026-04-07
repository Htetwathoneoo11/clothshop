<?php
use App\Http\Controllers\CartController;
use App\Http\Controllers\CheckoutController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Controller;
use App\Http\Controllers\ProductController;

Route::view('/{any?}', 'spa')->where('any', '.*');
Route::view('/', 'spa')->name('dashboard');
Route::view('/clothshop', 'spa')->name('dashboard');
Route::view('/dashboard', 'spa')->name('users.dashboard');
Route::view('/products/{product}', 'spa')->name('products.show');

use App\Http\Controllers\UserController;
Route::get('/profile', [UserController::class, 'showProfile'])->name('users.profile');
Route::view('/login', 'spa')->name('users.login');
Route::get('/register', [UserController::class, 'showRegister'])->name('users.register');
Route::post('/register', [UserController::class, 'register'])->name('users.register');
Route::get('/logout', [UserController::class, 'showLogout'])->name('users.logout');
Route::post('/logout', [UserController::class, 'logout'])->name('users.logout');

Route::middleware('auth')->group(function () {
    Route::post('/cart/add', [CartController::class, 'add'])->name('cart.add');
    Route::get('/cart', [CartController::class, 'index'])->name('cart.index');
    Route::post('/cart/update/{cartItem}', [CartController::class, 'update'])->name('cart.update');
    Route::post('/cart/remove/{cartItem}', [CartController::class, 'remove'])->name('cart.remove');

    Route::get('/checkout', [CheckoutController::class, 'index'])->name('checkout.index');
    Route::post('/checkout', [CheckoutController::class, 'store'])->name('checkout.store');
});
