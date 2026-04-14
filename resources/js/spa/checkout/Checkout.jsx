import React, { useEffect, useState } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

export default function Checkout() {
    const [items, setItems] = useState([]);
    const [subtotal, setSubtotal] = useState(0);
    const [message, setMessage] = useState('');

    useEffect(() => {
        axios.get('/api/cart').then((res) => {
            setItems(res.data.items || []);
            setSubtotal(res.data.subtotal || 0);
        });
    }, []);

    const handleCheckout = () => {
        axios.post('/api/checkout')
            .then((res) => setMessage(res.data.message || 'Checkout successful.'))
            .catch((err) => setMessage(err.response?.data?.message || 'Checkout failed.'));
    };

    return (
        <div className="page-container cart-checkout-page">
            <h1 className="page-title">Checkout</h1>
            {items.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                <>
                    <div className="checkout-summary">Total: ${subtotal.toFixed(2)}</div>
                    <button className="btn-primary" onClick={handleCheckout}>
                        Confirm Checkout
                    </button>
                </>
            )}
            {message && <p>{message}</p>}
        </div>
    );
}
