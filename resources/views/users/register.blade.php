@extends('layouts.app')

@section('title', 'register')

@section('content')
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
@endsection
