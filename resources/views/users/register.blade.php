@extends('layouts.app')

@section('title', 'register')

@section('main-class', 'content login-page')

@section('content')
    <div
        id="register-root"
        data-action="{{ route('users.register') }}"
        data-login-url="{{ route('users.login') }}"
        data-csrf="{{ csrf_token() }}"
        data-error="{{ $errors->first() }}"
        data-username="{{ old('username') }}"
        data-email="{{ old('email') }}"
    ></div>
    <noscript>
        <div class="register-box">
            <form action="{{ route('users.register') }}" method="POST">
                @csrf
                <label for="username">Username</label>
                <input type="text" name="username" placeholder="Enter Username" required><br>
                <label for="email">Email</label>
                <input type="email" name="email" placeholder="Enter Email" required><br>
                <label for="password">Password</label>
                <input type="password" name="password" placeholder="Enter Password" required><br>
                <button type="submit">Register</button><br><br>
                <a href="{{ route('users.login') }}">Already have an account? Login here</a>
            </form>
        </div>
    </noscript>
@endsection
