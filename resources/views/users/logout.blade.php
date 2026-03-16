@extends('layouts.app')

@section('title', 'Logout')

@section('content')
    <div class="logout-box">
        <h2>Logout</h2>
        <p>Are you sure you want to logout?</p>
        <form action="{{ route('users.logout') }}" method="POST">
            @csrf
            <button type="submit">Yes, Logout</button><br>
            <a href="{{ route('users.profile') }}">No, Go back to Profile</a>
        </form>
    </div>
@endsection
