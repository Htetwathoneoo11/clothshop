@extends('layouts.app')

@section('title', 'Logout')

@section('main-class', 'content login-page')

@section('content')
    <div
        id="logout-root"
        data-action="{{ route('users.logout') }}"
        data-profile-url="{{ route('users.profile') }}"
        data-csrf="{{ csrf_token() }}"
    ></div>
    <noscript>
        <div class="logout-box">
            <h2>Logout</h2>
            <p>Are you sure you want to logout?</p>
            <form action="{{ route('users.logout') }}" method="POST">
                @csrf
                <button type="submit">Yes, Logout</button><br>
                <a href="{{ route('users.profile') }}">No, Go back to Profile</a>
            </form>
        </div>
    </noscript>
@endsection
