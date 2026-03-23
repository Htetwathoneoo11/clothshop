@extends('layouts.app')

@section('title', 'profile')

@section('main-class', 'content login-page')

@section('content')
    <div
        id="profile-root"
        data-username="{{ Auth::user()->username }}"
        data-email="{{ Auth::user()->email }}"
        data-logout-url="{{ route('users.logout') }}"
    ></div>
    <noscript>
        <div class="profile-box">
            <h2>Profile</h2>
            <p><strong>Username:</strong> {{ Auth::user()->username }}</p>
            <p><strong>Email:</strong> {{ Auth::user()->email }}</p>
            <a href="{{ route('users.logout') }}">Logout</a>
        </div>
    </noscript>
@endsection
