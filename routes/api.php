<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AdminAuditLogController;
use App\Http\Controllers\Api\AdminCouponController;
use App\Http\Controllers\Api\AdminInventoryController;
use App\Http\Controllers\Api\AdminNotificationController;
use App\Http\Controllers\Api\AdminReportController;
use App\Http\Controllers\Api\AdminStaffInvitationController;
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
Route::post('/staff-invitations/accept', [AdminStaffInvitationController::class, 'accept']);
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
Route::post('/stripe/webhook', [OrderController::class, 'stripeWebhook']);

// Authenticated routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/avatar', [ProfileController::class, 'updateAvatar']);
    Route::delete('/me/avatar', [ProfileController::class, 'destroyAvatar']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders/stripe-confirm', [OrderController::class, 'confirmStripeCheckout']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::post('/orders/{order}/stripe-checkout', [OrderController::class, 'createStripeCheckoutSession']);

    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart', [CartController::class, 'store']);
    Route::post('/cart/coupon', [CartController::class, 'applyCoupon']);
    Route::delete('/cart/coupon', [CartController::class, 'removeCoupon']);
    Route::patch('/cart/{cartItem}', [CartController::class, 'update']);
    Route::delete('/cart/{cartItem}', [CartController::class, 'destroy']);

    Route::post('/checkout', [CheckoutController::class, 'store']);

    Route::middleware('can:access-admin')->group(function () {
        Route::get('/admin/dashboard', [OrderController::class, 'adminDashboard']);
        Route::get('/admin/notifications', [AdminNotificationController::class, 'index'])->middleware('can:view_notifications');
        Route::get('/admin/notifications/reviews', [AdminNotificationController::class, 'reviews'])->middleware('can:view_notifications');
        Route::post('/admin/notifications/bulk-review', [AdminNotificationController::class, 'bulkReview'])->middleware('can:view_notifications');
        Route::post('/admin/notifications/{notificationId}/review', [AdminNotificationController::class, 'review'])->middleware('can:view_notifications');
        Route::get('/admin/reports', [AdminReportController::class, 'index'])->middleware('can:view_reports');

        Route::middleware('can:manage_catalog')->group(function () {
            Route::get('/admin/products', [ProductController::class, 'adminIndex']);
            Route::get('/admin/products/{product}', [ProductController::class, 'adminShow']);
            Route::post('/admin/products', [ProductController::class, 'adminStore']);
            Route::put('/admin/products/{product}', [ProductController::class, 'adminUpdate']);
            Route::delete('/admin/products/{product}', [ProductController::class, 'adminDestroy']);
            Route::post('/admin/products/{product}/variants', [ProductController::class, 'adminAddVariant']);
            Route::put('/admin/product-variants/{variant}', [ProductController::class, 'adminUpdateVariant']);
            Route::delete('/admin/product-variants/{variant}', [ProductController::class, 'adminDeleteVariant']);
        });

        Route::middleware('can:manage_marketing')->group(function () {
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

        Route::middleware('can:manage_orders')->group(function () {
            Route::get('/admin/orders', [OrderController::class, 'adminIndex']);
            Route::get('/admin/orders/{order}', [OrderController::class, 'adminShow']);
            Route::patch('/admin/orders/{order}/status', [OrderController::class, 'adminUpdateStatus']);
        });

        Route::middleware('can:manage_users')->group(function () {
            Route::get('/admin/users', [AdminUserController::class, 'index']);
            Route::get('/admin/users/{user}', [AdminUserController::class, 'show']);
            Route::patch('/admin/users/{user}/status', [AdminUserController::class, 'updateStatus']);
            Route::patch('/admin/users/{user}/role', [AdminUserController::class, 'updateRole']);
            Route::get('/admin/staff-invitations', [AdminStaffInvitationController::class, 'index']);
            Route::post('/admin/staff-invitations', [AdminStaffInvitationController::class, 'store']);
            Route::patch('/admin/staff-invitations/{staffInvitation}/cancel', [AdminStaffInvitationController::class, 'cancel']);
        });

        Route::middleware('can:view_audit')->group(function () {
            Route::get('/admin/audit-logs', [AdminAuditLogController::class, 'index']);
            Route::get('/admin/audit-logs/{auditLog}', [AdminAuditLogController::class, 'show']);
        });

        Route::middleware('can:manage_loyalty')->group(function () {
            Route::get('/admin/coupons', [AdminCouponController::class, 'index']);
            Route::post('/admin/coupons', [AdminCouponController::class, 'store']);
            Route::get('/admin/coupons/{coupon}', [AdminCouponController::class, 'show']);
            Route::patch('/admin/coupons/{coupon}/expire', [AdminCouponController::class, 'expire']);
            Route::patch('/admin/coupons/{coupon}/reactivate', [AdminCouponController::class, 'reactivate']);
        });

        Route::middleware('can:manage_inventory')->group(function () {
            Route::get('/admin/inventory-variants', [AdminInventoryController::class, 'variants']);
            Route::get('/admin/inventory-adjustments', [AdminInventoryController::class, 'index']);
            Route::post('/admin/inventory-adjustments', [AdminInventoryController::class, 'store']);
            Route::get('/admin/inventory-adjustments/{inventoryAdjustment}', [AdminInventoryController::class, 'show']);
        });
    });
});
