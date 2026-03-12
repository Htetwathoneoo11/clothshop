<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () { return view('welcome'); });
Route::get('/clothshop', function () { return view('dashboard'); });
Route::get('/dashboard', function () { return view('dashboard'); });
