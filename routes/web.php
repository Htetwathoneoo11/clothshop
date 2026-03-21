<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Controller;
Route::get('/', [Controller::class, 'showDashboard'])->name('dashboard');
Route::get('/clothshop', [Controller::class, 'showDashboard'])->name('dashboard');
Route::get('/dashboard', [Controller::class, 'showDashboard'])->name('dashboard');

use App\Http\Controllers\UserController;
Route::get('/profile', [UserController::class, 'showProfile'])->name('users.profile');
Route::get('/dashboard', [UserController::class, 'showDashboard'])->name('users.dashboard');
Route::get('/login', [UserController::class, 'showLogin'])->name('users.login');
Route::post('/login', [UserController::class, 'login'])->name('users.login');
Route::get('/register', [UserController::class, 'showRegister'])->name('users.register');
Route::post('/register', [UserController::class, 'register'])->name('users.register');
Route::get('/logout', [UserController::class, 'showLogout'])->name('users.logout');
Route::post('/logout', [UserController::class, 'logout'])->name('users.logout');
