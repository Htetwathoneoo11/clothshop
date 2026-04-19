<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\UserController;

Route::get('/', [UserController::class, 'index']);
Route::view('/clothshop', 'spa');
Route::view('/clothshop/{any?}', 'spa')->where('any', '.*');
