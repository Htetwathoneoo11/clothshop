import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';

axios.defaults.withCredentials = true;

function FooterLinkList({ links }) {
    return (
        <ul className="site-footer-list">
            {links.map((link) => (
                <li key={link.to}>
                    <Link to={link.to}>{link.label}</Link>
                </li>
            ))}
        </ul>
    );
}

export default function Footer() {
    const [user, setUser] = useState(null);
    const location = useLocation();
    const isAdmin = Boolean(user?.is_admin);
    const can = (permission) => Boolean(user?.permissions?.[permission] ?? isAdmin);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (!cancelled) setUser(res.data?.user || null);
            })
            .catch(() => {
                if (!cancelled) setUser(null);
            });

        return () => {
            cancelled = true;
        };
    }, [location.pathname]);

    const adminPrimaryLinks = [
        { label: 'Dashboard', to: '/admin', show: true },
        { label: 'Orders', to: '/admin/orders', show: can('manage_orders') },
        { label: 'Users', to: '/admin/users', show: can('manage_users') },
        { label: 'Products', to: '/admin/products', show: can('manage_catalog') },
    ].filter((link) => link.show);

    const adminChildLinks = [
        { label: 'Analytics Reports', to: '/admin/reports', show: can('view_reports') },
        { label: 'Coupons', to: '/admin/coupons', show: can('manage_loyalty') },
        { label: 'Audit Logs', to: '/admin/audit-logs', show: can('view_audit') },
        { label: 'Inventory History', to: '/admin/inventory', show: can('manage_inventory') },
        { label: 'Boards', to: '/admin/boards', show: can('manage_marketing') },
    ].filter((link) => link.show);

    const adminSystemLinks = [
        { label: 'Notifications', to: '/admin/notifications', show: can('view_notifications') },
        { label: 'Admin Profile', to: '/profile', show: true },
        { label: 'Preview Storefront', to: '/dashboard', show: true },
    ].filter((link) => link.show);

    return (
        <footer className={`site-footer ${isAdmin ? 'site-footer--admin' : ''}`}>
            <div className="site-footer-grid">
                <section className="site-footer-section">
                    <h3 className="site-footer-title">{isAdmin ? 'Admin Workspace' : 'Brand'}</h3>
                    <p className="site-footer-brand">Clothshop</p>
                    <p className="site-footer-text">
                        {isAdmin
                            ? 'Operational tools grouped by dashboard, orders, users, and products.'
                            : 'Everyday essentials, curated for you.'}
                    </p>
                    {isAdmin ? <span className="site-footer-admin-chip">{user?.role_label || 'Admin'}</span> : null}
                </section>

                {isAdmin ? (
                    <>
                        <section className="site-footer-section">
                            <h3 className="site-footer-title">Primary Admin</h3>
                            <FooterLinkList links={adminPrimaryLinks} />
                        </section>

                        <section className="site-footer-section">
                            <h3 className="site-footer-title">Related Tools</h3>
                            <FooterLinkList links={adminChildLinks} />
                        </section>

                        <section className="site-footer-section">
                            <h3 className="site-footer-title">System</h3>
                            <FooterLinkList links={adminSystemLinks} />
                        </section>
                    </>
                ) : (
                    <>
                        <section className="site-footer-section">
                            <h3 className="site-footer-title">Shop</h3>
                            <FooterLinkList links={[
                                { label: 'Shop', to: '/dashboard' },
                                { label: 'Cart', to: '/cart' },
                                { label: 'Checkout', to: '/checkout' },
                                { label: 'Profile', to: '/profile' },
                            ]} />
                        </section>

                        <section className="site-footer-section">
                            <h3 className="site-footer-title">Help</h3>
                            <FooterLinkList links={[
                                { label: 'Contact', to: '/contact' },
                                { label: 'Shipping & Delivery', to: '/shipping-delivery' },
                                { label: 'Returns', to: '/returns' },
                                { label: 'FAQ', to: '/faq' },
                            ]} />
                        </section>

                        <section className="site-footer-section">
                            <h3 className="site-footer-title">Follow</h3>
                            <ul className="site-footer-list">
                                <li><a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a></li>
                                <li><a href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook</a></li>
                                <li><a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">TikTok</a></li>
                            </ul>
                        </section>
                    </>
                )}

                <section className="site-footer-section">
                    <h3 className="site-footer-title">{isAdmin ? 'Policy' : 'Legal'}</h3>
                    <FooterLinkList links={[
                        { label: 'Privacy Policy', to: '/privacy-policy' },
                        { label: 'Terms of Service', to: '/terms-of-service' },
                    ]} />
                </section>

                <section className="site-footer-section">
                    <h3 className="site-footer-title">{isAdmin ? 'Process' : 'Trust'}</h3>
                    <p className="site-footer-text">
                        {isAdmin
                            ? 'Secondary tools live under parent admin pages to keep the workflow focused.'
                            : 'Secure checkout supported.'}
                    </p>
                </section>
            </div>
            <div className="site-footer-bottom">
                <span className="site-footer-bottom-label">Copyright</span>
                <p className="site-footer-copy">Copyright 2026 Clothshop. All rights reserved.</p>
            </div>
        </footer>
    );
}
