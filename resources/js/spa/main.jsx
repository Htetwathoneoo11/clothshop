import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

const root = createRoot(document.getElementById('app'));

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
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
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
