import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
axios.defaults.withCredentials = true;
import Dashboard from './Dashboard.jsx';
import Login from './users/Login.jsx';
import Register from './users/Register.jsx';
import ForgotPassword from './users/ForgotPassword.jsx';
import ResetPassword from './users/ResetPassword.jsx';
import VerifyEmailCode from './users/VerifyEmailCode.jsx';
import StaffInvitationAccept from './users/StaffInvitationAccept.jsx';
import Profile from './users/Profile.jsx';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import Cart from './cart/Cart.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import Checkout from './checkout/Checkout.jsx';
import StripeReturn from './checkout/StripeReturn.jsx';
import ProductDetail from './products/ProductDetail.jsx';
import {
    ContactPage,
    ShippingPage,
    ReturnsPage,
    FaqPage,
    PrivacyPolicyPage,
    TermsPage,
} from './info/InfoPages.jsx';
import BoardsAdmin from './admin/BoardsAdmin.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import AdminOrders from './admin/AdminOrders.jsx';
import AdminUsers from './admin/AdminUsers.jsx';
import AdminAuditLogs from './admin/AdminAuditLogs.jsx';
import AdminCoupons from './admin/AdminCoupons.jsx';
import AdminInventory from './admin/AdminInventory.jsx';
import AdminNotifications from './admin/AdminNotifications.jsx';
import AdminReports from './admin/AdminReports.jsx';
import AdminProductsList from './admin/AdminProductsList.jsx';
import AdminProductCreate from './admin/AdminProductCreate.jsx';
import AdminProductEdit from './admin/AdminProductEdit.jsx';

const root = createRoot(document.getElementById('app'));

function PurchaseGuard({ children }) {
    const [status, setStatus] = useState('loading');
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const admin = Boolean(res.data?.user?.is_admin);
                setIsAdmin(admin);
                setStatus('ready');
            })
            .catch(() => {
                if (cancelled) return;
                setIsAdmin(false);
                setStatus('ready');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (status === 'loading') {
        return null;
    }

    if (isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

root.render(
    <BrowserRouter basename="/clothshop">
        <CartProvider>
            <Navbar />
            <main className="app-main">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/products/:id" element={<ProductDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email-code" element={<VerifyEmailCode />} />
                    <Route path="/verify-email" element={<VerifyEmailCode />} />
                    <Route path="/verify-email-notice" element={<VerifyEmailCode />} />
                    <Route path="/staff-invitation/accept" element={<StaffInvitationAccept />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/orders" element={<AdminOrders />} />
                    <Route path="/admin/orders/:id" element={<AdminOrders />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/users/:id" element={<AdminUsers />} />
                    <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                    <Route path="/admin/audit-logs/:id" element={<AdminAuditLogs />} />
                    <Route path="/admin/coupons" element={<AdminCoupons />} />
                    <Route path="/admin/coupons/:id" element={<AdminCoupons />} />
                    <Route path="/admin/inventory" element={<AdminInventory />} />
                    <Route path="/admin/inventory/:id" element={<AdminInventory />} />
                    <Route path="/admin/notifications" element={<AdminNotifications />} />
                    <Route path="/admin/reports" element={<AdminReports />} />
                    <Route path="/admin/boards" element={<BoardsAdmin />} />
                    <Route path="/admin/products" element={<AdminProductsList />} />
                    <Route path="/admin/products/create" element={<AdminProductCreate />} />
                    <Route path="/admin/products/:id/edit" element={<AdminProductEdit />} />
                    <Route
                        path="/cart"
                        element={(
                            <PurchaseGuard>
                                <Cart />
                            </PurchaseGuard>
                        )}
                    />
                    <Route
                        path="/checkout"
                        element={(
                            <PurchaseGuard>
                                <Checkout />
                            </PurchaseGuard>
                        )}
                    />
                    <Route
                        path="/payment/stripe/success"
                        element={(
                            <PurchaseGuard>
                                <StripeReturn />
                            </PurchaseGuard>
                        )}
                    />
                    <Route
                        path="/payment/stripe/cancel"
                        element={(
                            <PurchaseGuard>
                                <StripeReturn cancelled />
                            </PurchaseGuard>
                        )}
                    />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/shipping-delivery" element={<ShippingPage />} />
                    <Route path="/returns" element={<ReturnsPage />} />
                    <Route path="/faq" element={<FaqPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms-of-service" element={<TermsPage />} />
                </Routes>
            </main>
            <Footer />
        </CartProvider>
    </BrowserRouter>
);
