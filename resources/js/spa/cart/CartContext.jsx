import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { listenForAuthChange } from '../utils/authEvents.js';

axios.defaults.withCredentials = true;

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [cartCount, setCartCount] = useState(0);

    const refreshCartCount = async () => {
        try {
            const res = await axios.get('/api/cart');
            const items = res.data.items || [];
            const count = items.reduce((sum, item) => sum + item.quantity, 0);
            setCartCount(count);
        } catch {
            setCartCount(0);
        }
    };

    useEffect(() => {
        refreshCartCount();
    }, []);

    useEffect(() => listenForAuthChange(() => {
        refreshCartCount();
    }), []);

    return (
        <CartContext.Provider value={{ cartCount, refreshCartCount }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    return useContext(CartContext);
}
