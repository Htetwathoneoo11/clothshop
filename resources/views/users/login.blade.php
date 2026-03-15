@extends('layouts.app')

@section('title', 'login')

@section('content')
    <div class="login-box">

        <form action="{{ route('users.login') }}" method="POST">
            @csrf
            @if ($errors->any())
            <div class="error-message">
                {{ $errors->first() }}
            </div>
            @endif
            <label for="username">Username</label>
            <input type="text" name="username" placeholder="Enter Username" required><br>
            <label for="password">Password</label>
            <input type="password" name="password" placeholder="Enter Password" required><br>
            <button type="submit">Login</button><br>
            <a href="{{ route('users.register') }}">Don't have an account? Register here</a>
        </form>
    </div>
@endsection
