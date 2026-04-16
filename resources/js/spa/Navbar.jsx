import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink, useLocation } from 'react-router-dom';
import { House, ShoppingCart } from 'lucide-react';
import { useCart } from './cart/CartContext.jsx';



axios.defaults.withCredentials = true;

function initialsFromUsername(username) {
    if (!username) return '?';
    const parts = String(username).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(username).slice(0, 2).toUpperCase();
}

export default function Navbar() {
    const [user, setUser] = useState(null);
    const { cartCount } = useCart();
    const location = useLocation();
    useEffect(() => {
        axios.get('/api/me')
            .then((res) => setUser(res.data.user))
            .catch(() => setUser(null));
    }, [location.pathname]);

    return (
        <header className="navbar">
            <div className="navbar-brand">
                <NavLink to="/dashboard" className="navbar-brand-link" end>
                    <img src="/images/logo.png" alt="" className="navbar-brand-logo" width="40" height="40" />
                    <span className="navbar-brand-text">Clothshop</span>
                </NavLink>
            </div>
            <nav className="nav-links" aria-label="Main">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) => `nav-link nav-link--icon ${isActive ? 'nav-link-active' : ''}`}
                    title="Shop"
                    aria-label="Shop"
                >
                    <House size={18} strokeWidth={2.2} aria-hidden="true" />
                </NavLink>
                {user ? (
                    <>
                        <NavLink
                            to="/cart"
                            className={({ isActive }) => `nav-link nav-link--icon nav-link--cart ${isActive ? 'nav-link-active' : ''}`}
                            title="Cart"
                            aria-label="Cart"
                        >
                            <ShoppingCart size={18} strokeWidth={2.2} aria-hidden="true" />
                            {cartCount > 0 ? <span className="nav-cart-badge">{cartCount}</span> : null}
                        </NavLink>
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
