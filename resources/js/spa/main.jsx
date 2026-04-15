import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
axios.defaults.withCredentials = true;
import Dashboard from './Dashboard.jsx';
import Login from './users/Login.jsx';
import Navbar from './Navbar.jsx';
import Cart from './cart/Cart.jsx';
import { CartProvider } from './cart/CartContext.jsx';
import Checkout from './checkout/Checkout.jsx';
import ProductDetail from './products/ProductDetail.jsx';

const root = createRoot(document.getElementById('app'));

root.render(
    <BrowserRouter>
        <CartProvider>
            <Navbar />
            <main className="app-main">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/products/:id" element={<ProductDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                </Routes>
            </main>
        </CartProvider>
    </BrowserRouter>
);
