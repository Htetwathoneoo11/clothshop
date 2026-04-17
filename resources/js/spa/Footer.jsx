import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="site-footer-grid">
                <section className="site-footer-section">
                    <h3 className="site-footer-title">Brand</h3>
                    <p className="site-footer-brand">Clothshop</p>
                    <p className="site-footer-text">Everyday essentials, curated for you.</p>
                </section>

                <section className="site-footer-section">
                    <h3 className="site-footer-title">Shop</h3>
                    <ul className="site-footer-list">
                        <li><Link to="/dashboard">Shop</Link></li>
                        <li><Link to="/cart">Cart</Link></li>
                        <li><Link to="/checkout">Checkout</Link></li>
                        <li><Link to="/profile">Profile</Link></li>
                    </ul>
                </section>

                <section className="site-footer-section">
                    <h3 className="site-footer-title">Help</h3>
                    <ul className="site-footer-list">
                        <li><Link to="/contact">Contact</Link></li>
                        <li><Link to="/shipping-delivery">Shipping & Delivery</Link></li>
                        <li><Link to="/returns">Returns</Link></li>
                        <li><Link to="/faq">FAQ</Link></li>
                    </ul>
                </section>

                <section className="site-footer-section">
                    <h3 className="site-footer-title">Legal</h3>
                    <ul className="site-footer-list">
                        <li><Link to="/privacy-policy">Privacy Policy</Link></li>
                        <li><Link to="/terms-of-service">Terms of Service</Link></li>
                    </ul>
                </section>

                <section className="site-footer-section">
                    <h3 className="site-footer-title">Follow</h3>
                    <ul className="site-footer-list">
                        <li><a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a></li>
                        <li><a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook</a></li>
                        <li><a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">TikTok</a></li>
                    </ul>
                </section>

                <section className="site-footer-section">
                    <h3 className="site-footer-title">Trust</h3>
                    <p className="site-footer-text">Secure checkout supported.</p>
                </section>
            </div>
            <div className="site-footer-bottom">
                <span className="site-footer-bottom-label">Copyright</span>
                <p className="site-footer-copy">© 2026 Clothshop. All rights reserved.</p>
            </div>
        </footer>
    );
}
