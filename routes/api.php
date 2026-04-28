<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BoardController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ProfileController;

// Public auth + catalog
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/forgot-password', [PasswordResetController::class, 'sendResetLink']);
Route::post('/auth/validate-reset-token', [PasswordResetController::class, 'validateToken']);
Route::post('/auth/reset-password', [PasswordResetController::class, 'reset']);
Route::post('/auth/verify-email-code', [EmailVerificationController::class, 'verifyCode'])
    ->middleware('throttle:10,1');
Route::post('/auth/resend-email-code', [EmailVerificationController::class, 'resendCode'])
    ->middleware('throttle:6,1');

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show']);

Route::get('/boards/active', [BoardController::class, 'active']);
Route::get('/hero-banner/active', [BoardController::class, 'active']);

// Authenticated routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/avatar', [ProfileController::class, 'updateAvatar']);
    Route::delete('/me/avatar', [ProfileController::class, 'destroyAvatar']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/orders', [OrderController::class, 'index']);

    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart', [CartController::class, 'store']);
    Route::patch('/cart/{cartItem}', [CartController::class, 'update']);
    Route::delete('/cart/{cartItem}', [CartController::class, 'destroy']);

    Route::post('/checkout', [CheckoutController::class, 'store']);

    Route::middleware('can:access-admin')->group(function () {
        Route::get('/admin/products', [ProductController::class, 'adminIndex']);
        Route::get('/admin/products/{product}', [ProductController::class, 'adminShow']);
        Route::post('/admin/products', [ProductController::class, 'adminStore']);
        Route::put('/admin/products/{product}', [ProductController::class, 'adminUpdate']);
        Route::delete('/admin/products/{product}', [ProductController::class, 'adminDestroy']);
        Route::post('/admin/products/{product}/variants', [ProductController::class, 'adminAddVariant']);
        Route::put('/admin/product-variants/{variant}', [ProductController::class, 'adminUpdateVariant']);
        Route::delete('/admin/product-variants/{variant}', [ProductController::class, 'adminDeleteVariant']);

        Route::get('/admin/boards', [BoardController::class, 'index']);
        Route::get('/admin/hero-banners', [BoardController::class, 'index']);
        Route::post('/admin/boards', [BoardController::class, 'store']);
        Route::post('/admin/hero-banners', [BoardController::class, 'store']);
        Route::post('/admin/boards/{board}/duplicate', [BoardController::class, 'duplicate']);
        Route::post('/admin/hero-banners/{board}/duplicate', [BoardController::class, 'duplicate']);
        Route::post('/admin/boards/{board}/toggle-active', [BoardController::class, 'toggleActive']);
        Route::post('/admin/hero-banners/{board}/toggle-active', [BoardController::class, 'toggleActive']);
        Route::post('/admin/boards/{board}/shift-priority', [BoardController::class, 'shiftPriority']);
        Route::post('/admin/hero-banners/{board}/shift-priority', [BoardController::class, 'shiftPriority']);
        Route::put('/admin/boards/{board}', [BoardController::class, 'update']);
        Route::put('/admin/hero-banners/{board}', [BoardController::class, 'update']);
        Route::delete('/admin/boards/{board}', [BoardController::class, 'destroy']);
        Route::delete('/admin/hero-banners/{board}', [BoardController::class, 'destroy']);
    });
});
