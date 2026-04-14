import React, { useEffect, useState } from 'react';
import axios from 'axios';
axios.defaults.withCredentials = true;
import { useCart } from './CartContext.jsx';

export default function Cart() {
    const [items, setItems] = useState([]);
    const [subtotal, setSubtotal] = useState(0);
    const { refreshCartCount } = useCart();

    const loadCart = () => {
        axios.get('/api/cart').then((res) => {
            setItems(res.data.items || []);
            setSubtotal(res.data.subtotal || 0);
            refreshCartCount();
        });
    };

    useEffect(() => {
        loadCart();
    }, []);

    const updateQty = (id, quantity) => {
        axios.patch(`/api/cart/${id}`, { quantity }).then(loadCart);
    };

    const removeItem = (id) => {
        axios.delete(`/api/cart/${id}`).then(loadCart);
    };

    return (
        <div className="page-container cart-checkout-page">
            <h1 className="page-title">Your Cart</h1>
            {items.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                <>
                    <div className="cart-checkout-grid">
                        {items.map((item) => (
                            <div key={item.id} className="grid-item-simple">
                                {item.variant.product.name} ({item.variant.color}/{item.variant.size})
                                <div>
                                    Qty:
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateQty(item.id, Number(e.target.value))}
                                    />
                                </div>
                                <button onClick={() => removeItem(item.id)}>Remove</button>
                            </div>
                        ))}
                    </div>
                    <div className="cart-summary">Subtotal: ${subtotal.toFixed(2)}</div>
                </>
            )}
        </div>
    );
}
