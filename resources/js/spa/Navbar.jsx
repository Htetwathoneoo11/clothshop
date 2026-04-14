import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';
import { useCart } from './cart/CartContext.jsx'



axios.defaults.withCredentials = true;

export default function Navbar() {
    const [user, setUser] = useState(null);
    const { cartCount } = useCart();
    useEffect(() => {
        axios.get('/api/me')
            .then((res) => setUser(res.data.user))
            .catch(() => setUser(null));
    }, []);

    return (
        <header className="navbar">
            <div className="navbar-brand">
                <NavLink to="/dashboard" className="navbar-brand-link"
                > <img src="/images/logo.png" alt="Clothshop" className="navbar-brand-logo" />
                </NavLink>
            </div>
            <nav className="nav-links">
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Dashboard</NavLink>
                {user ? (
                    <>
                        <NavLink to="/cart" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}> Cart ({cartCount})</NavLink>
                        <NavLink to="/checkout" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Checkout</NavLink>
                    </>
                ) : (
                    <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>Login</NavLink>
                )}
            </nav>
        </header>
    );
}
