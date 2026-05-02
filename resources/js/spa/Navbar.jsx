import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Box, ClipboardList, Gauge, House, ShoppingCart, Users } from 'lucide-react';
import { useCart } from './cart/CartContext.jsx';
import { listenForAuthChange } from './utils/authEvents.js';



axios.defaults.withCredentials = true;

function initialsFromUsername(username) {
    if (!username) return '?';
    const parts = String(username).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(username).slice(0, 2).toUpperCase();
}

export default function Navbar() {
    const [user, setUser] = useState(null);
    const [notificationCount, setNotificationCount] = useState(0);
    const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
    const { cartCount, refreshCartCount } = useCart();
    const location = useLocation();
    const navigate = useNavigate();
    const can = (permission) => Boolean(user?.permissions?.[permission] ?? user?.is_admin);
    const isPathActive = (path) => {
        if (location.pathname === path) return true;
        return location.pathname.startsWith(`${path}/`);
    };
    const isAdminSectionActive = (paths) => paths.some((path) => isPathActive(path));
    const isDashboardActive = location.pathname === '/admin'
        || isPathActive('/admin/dashboard')
        || isPathActive('/admin/reports');

    const refreshUser = () => axios.get('/api/me')
        .then((res) => {
            const nextUser = res.data.user || null;
            setUser(nextUser);
            return nextUser;
        })
        .catch(() => {
            setUser(null);
            return null;
        });

    useEffect(() => {
        refreshUser();
    }, [location.pathname]);

    useEffect(() => {
        if (!user?.permissions?.view_notifications) {
            setNotificationCount(0);
            return undefined;
        }

        let cancelled = false;
        axios.get('/api/admin/notifications')
            .then((res) => {
                if (cancelled) return;
                const counts = res.data?.counts || {};
                setNotificationCount(Number(counts.critical || 0) + Number(counts.warning || 0));
            })
            .catch(() => {
                if (!cancelled) setNotificationCount(0);
            });

        return () => {
            cancelled = true;
        };
    }, [user?.id, user?.permissions?.view_notifications, location.pathname, notificationRefreshKey]);

    useEffect(() => {
        const refreshNotifications = () => setNotificationRefreshKey((key) => key + 1);
        window.addEventListener('admin-notifications-reviewed', refreshNotifications);
        return () => {
            window.removeEventListener('admin-notifications-reviewed', refreshNotifications);
        };
    }, []);

    useEffect(() => listenForAuthChange(async (event) => {
        const nextUser = await refreshUser();
        refreshCartCount();

        const path = location.pathname;
        const isPurchasePath = path === '/cart' || path === '/checkout';
        const isProtectedPath = isPurchasePath || path === '/profile' || path.startsWith('/admin');

        if (!nextUser && isProtectedPath) {
            navigate('/login', { replace: true });
            return;
        }

        if (nextUser?.is_admin && isPurchasePath) {
            navigate('/dashboard', { replace: true });
            return;
        }

        if (nextUser && !nextUser.is_admin && path.startsWith('/admin')) {
            navigate('/dashboard', { replace: true });
        }
    }), [location.pathname, navigate, refreshCartCount]);

    return (
        <header className="navbar">
            <div className="navbar-brand">
                <NavLink to={user?.is_admin ? '/admin' : '/dashboard'} className="navbar-brand-link" end>
                    <img src="/images/logo.png" alt="" className="navbar-brand-logo" width="40" height="40" />
                    <span className="navbar-brand-text">Clothshop</span>
                </NavLink>
            </div>
            <nav className="nav-links" aria-label="Main">
                {!user?.is_admin ? (
                    <NavLink
                        to="/dashboard"
                        className={({ isActive }) => `nav-link nav-link--icon ${isActive ? 'nav-link-active' : ''}`}
                        title="Shop"
                        aria-label="Shop"
                    >
                        <House size={18} strokeWidth={2.2} aria-hidden="true" />
                    </NavLink>
                ) : null}
                {user ? (
                    <>
                        {!user.is_admin ? (
                            <NavLink
                                to="/cart"
                                className={({ isActive }) => `nav-link nav-link--icon nav-link--cart ${isActive ? 'nav-link-active' : ''}`}
                                title="Cart"
                                aria-label="Cart"
                            >
                                <ShoppingCart size={18} strokeWidth={2.2} aria-hidden="true" />
                                {cartCount > 0 ? <span className="nav-cart-badge">{cartCount}</span> : null}
                            </NavLink>
                        ) : null}
                        {user.is_admin ? (
                            <>
                                <NavLink
                                    to="/admin"
                                    className={() => `nav-link nav-link--icon ${isDashboardActive ? 'nav-link-active' : ''}`}
                                    title="Admin dashboard"
                                    aria-label="Admin dashboard"
                                >
                                    <Gauge size={18} strokeWidth={2.2} aria-hidden="true" />
                                </NavLink>
                                {can('manage_orders') ? (
                                    <NavLink
                                        to="/admin/orders"
                                        className={() => `nav-link nav-link--icon ${isAdminSectionActive(['/admin/orders', '/admin/coupons']) ? 'nav-link-active' : ''}`}
                                        title="Orders"
                                        aria-label="Orders"
                                    >
                                        <ClipboardList size={18} strokeWidth={2.2} aria-hidden="true" />
                                    </NavLink>
                                ) : null}
                                {can('manage_users') ? (
                                    <NavLink
                                        to="/admin/users"
                                        className={() => `nav-link nav-link--icon ${isAdminSectionActive(['/admin/users', '/admin/audit-logs']) ? 'nav-link-active' : ''}`}
                                        title="Users"
                                        aria-label="Users"
                                    >
                                        <Users size={18} strokeWidth={2.2} aria-hidden="true" />
                                    </NavLink>
                                ) : null}
                                {can('manage_catalog') ? (
                                    <NavLink
                                        to="/admin/products"
                                        className={() => `nav-link nav-link--icon ${isAdminSectionActive(['/admin/products', '/admin/inventory', '/admin/boards']) ? 'nav-link-active' : ''}`}
                                        title="Products"
                                        aria-label="Products"
                                    >
                                        <Box size={18} strokeWidth={2.2} aria-hidden="true" />
                                    </NavLink>
                                ) : null}
                                {can('view_notifications') ? (
                                    <NavLink
                                        to="/admin/notifications"
                                        className={({ isActive }) => `nav-link nav-link--icon nav-link--admin-alert ${isActive ? 'nav-link-active' : ''}`}
                                        title="Notifications"
                                        aria-label="Notifications"
                                    >
                                        <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
                                        {notificationCount > 0 ? (
                                            <span className="nav-admin-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>
                                        ) : null}
                                    </NavLink>
                                ) : null}
                            </>
                        ) : null}
                        <NavLink
                            to="/profile"
                            className={({ isActive }) => `nav-link nav-link--profile ${isActive ? 'nav-link-active' : ''}`}
                            title="Your profile"
                            aria-label="Your profile"
                        >
                            {user.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    alt=""
                                    className="nav-profile-avatar"
                                    onError={(event) => {
                                        event.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <span className="nav-profile-fallback" aria-hidden="true">
                                    {initialsFromUsername(user.username)}
                                </span>
                            )}
                        </NavLink>
                    </>
                ) : (
                    <NavLink to="/login" className={({ isActive }) => `nav-link nav-link--cta ${isActive ? 'nav-link-active' : ''}`}>Sign in</NavLink>
                )}
            </nav>
        </header>
    );
}
