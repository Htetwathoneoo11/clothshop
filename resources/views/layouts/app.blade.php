<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'My App')</title>
    <script src="https://cdn.tailwindcss.com"></script>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('styles')
</head>
<body class="flex flex-col min-h-screen">
    {{-- Header / Navbar --}}
    <header class="navbar">
        <div class="navbar-brand">Online Shop</div>
        <nav class="nav-links">
            <a href="{{ url('/dashboard') }}" class="nav-link {{ request()->routeIs('dashboard') ? 'nav-link-active' : '' }}">Dashboard</a>
        </nav>
    </header>

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
