import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink, useLocation } from 'react-router-dom';
import { useCart } from './cart/CartContext.jsx'



axios.defaults.withCredentials = true;

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
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Shop</NavLink>
                {user ? (
                    <>
                        <NavLink to="/cart" className={({ isActive }) => `nav-link nav-link--cart ${isActive ? 'nav-link-active' : ''}`}>
                            Cart
                            {cartCount > 0 ? <span className="nav-cart-badge">{cartCount}</span> : null}
                        </NavLink>
                        <NavLink to="/checkout" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Checkout</NavLink>
                    </>
                ) : (
                    <NavLink to="/login" className={({ isActive }) => `nav-link nav-link--cta ${isActive ? 'nav-link-active' : ''}`}>Sign in</NavLink>
                )}
            </nav>
        </header>
    );
}
