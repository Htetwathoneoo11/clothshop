@extends('layouts.app')

@section('title', 'profile')

@section('content')
    <div class="profile-box">
        <h2>Profile</h2>
        <p><strong>Username:</strong> {{ Auth::user()->username }}</p>
        <p><strong>Email:</strong> {{ Auth::user()->email }}</p>
        <p><strong>Last Login:</strong> {{ Auth::user()->last_login_at }}</p>
        <p><strong>Last Login IP:</strong> {{ Auth::user()->last_login_ip }}</p>
        <p><strong>User Agent:</strong> {{ Auth::user()->user_agent }}</p>
        <a href="{{ route('users.logout') }}">Logout</a>
    </div>
@endsection
