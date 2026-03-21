@extends('layouts.app')

@section('title', 'profile')

@section('content')
    <div class="profile-box">
        <h2>Profile</h2>
        <p><strong>Username:</strong> {{ Auth::user()->username }}</p>
        <p><strong>Email:</strong> {{ Auth::user()->email }}</p>
        <a href="{{ route('users.logout') }}">Logout</a>
    </div>
@endsection
