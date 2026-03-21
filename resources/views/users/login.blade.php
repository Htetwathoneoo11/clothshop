@extends('layouts.app')

@section('title', 'Login')

@section('main-class', 'content login-page')

@section('content')
    <div
        id="login-root"
        data-action="{{ route('users.login') }}"
        data-register-url="{{ route('users.register') }}"
        data-csrf="{{ csrf_token() }}"
        data-error="{{ $errors->first() ?: session('error') }}"
        data-username="{{ old('username') }}"
    >Loading...</div>
    <noscript>
        <div class="login-box">
            <h2>Sign in</h2>
            <form action="{{ route('users.login') }}" method="POST">
                @csrf
                @if ($errors->any() || session('error'))
                <div class="error-message" role="alert">
                    {{ $errors->first() ?: session('error') }}
                </div>
                @endif
                <div class="form-group">
                    <label for="username">Username</label>
                    <span class="error-message" role="alert">
                        {{ $errors->first('username') }}
                    </span>
                    <input type="text" id="username" name="username" value="{{ old('username') }}" placeholder="Enter username">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <span class="error-message" role="alert">
                        {{ $errors->first('password') }}
                    </span>
                    <input type="password" id="password" name="password" placeholder="Enter password">
                </div>
                <button type="submit" class="login-submit">Login</button>
                <div class="login-footer">
                    <a href="{{ route('users.register') }}">Don't have an account? Register here</a>
                </div>
            </form>
        </div>
    </noscript>
@endsection
