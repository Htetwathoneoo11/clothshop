import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
axios.defaults.withCredentials = true;
import Dashboard from './Dashboard.jsx';
import Login from './users/Login.jsx';
import Register from './users/Register.jsx';
import Profile from './users/Profile.jsx';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import Cart from './cart/Cart.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import Checkout from './checkout/Checkout.jsx';
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
                    <Route path="/profile" element={<Profile />} />
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


