<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'My App')</title>
    <script src="https://cdn.tailwindcss.com"></script>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/css/login.css', 'resources/css/product.css', 'resources/js/app.js'])
    @stack('styles')
</head>
<body class="flex flex-col min-h-screen">
    {{-- Header / Navbar --}}
    <header class="navbar">
        <div class="navbar-brand">
        <a href="{{ url('/dashboard') }}" class="navbar-brand"><img src="{{ asset('images/logo.png') }}" alt="Logo" class="logo"></a>
        </div>
        <nav class="nav-links">
            <a href="{{ url('/dashboard') }}" class="nav-link {{ request()->routeIs('dashboard') || request()->routeIs('users.dashboard') || request()->routeIs('products.show') ? 'nav-link-active' : '' }}">Dashboard</a>
                    
            @auth
                <a href="{{ route('users.profile') }}" class="nav-link {{ request()->routeIs('users.profile') ? 'nav-link-active' : '' }}">Profile</a>
                <a href="{{ route('cart.index') }}" class="nav-link {{ request()->routeIs('cart.*') ? 'nav-link-active' : '' }}">Cart ({{ $cartCount ?? 0 }})</a>
            @else
                <a href="{{ route('users.login') }}" class="nav-link {{ request()->routeIs('users.login') ? 'nav-link-active' : '' }}">Login</a>
            @endauth
        </nav>
    </header>

    @if (session('success'))
        <div class="success-message toast-notification" role="status" aria-live="polite">
            <span>{{ session('success') }}</span>
            <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
        </div>
    @endif
    @if (session('error'))
        <div class="success-message toast-notification" role="status" aria-live="polite">
            <span>{{ session('error') }}</span>
            <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
        </div>
    @endif

    {{-- Main content --}}
    <main class="@yield('main-class', 'content') flex-grow">
        @yield('content')
    </main>

    {{-- Footer --}}
    <footer class="footer">
            <span class="footer-copy">&copy; {{ date('Y') }} My Dashboard. All rights reserved.</span>
    </footer>

    @stack('scripts')
</body>
</html>
