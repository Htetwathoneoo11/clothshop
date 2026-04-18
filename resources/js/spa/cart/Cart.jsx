import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
axios.defaults.withCredentials = true;
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, CreditCard, ArrowRight } from 'lucide-react';
import { useCart } from './CartContext.jsx';
import { formatMMK, toIntegerMMK } from '../utils/money.js';

export default function Cart() {
    const [items, setItems] = useState([]);
    const [subtotalMmk, setSubtotalMmk] = useState(0);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const { refreshCartCount } = useCart();

    const loadCart = () => {
        setLoading(true);
        axios
            .get('/api/cart')
            .then((res) => {
                setItems(res.data.items || []);
                setSubtotalMmk(toIntegerMMK(res.data.subtotal_mmk));
                refreshCartCount();
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadCart();
    }, []);

    const updateQty = (id, quantity) => {
        const safeQty = Math.max(1, Number(quantity) || 1);
        setUpdatingId(id);
        axios
            .patch(`/api/cart/${id}`, { quantity: safeQty })
            .then(loadCart)
            .finally(() => setUpdatingId(null));
    };

    const removeItem = (id) => {
        setUpdatingId(id);
        axios
            .delete(`/api/cart/${id}`)
            .then(loadCart)
            .finally(() => setUpdatingId(null));
    };

    const totalItems = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        [items]
    );

    return (
        <div className="cart-page">
            <header className="cart-page-header">
                <div>
                    <p className="cart-eyebrow">
                        <ShoppingBag size={14} strokeWidth={2.2} aria-hidden="true" />
                        Your bag
                    </p>
                    <h1 className="cart-title">Shopping Cart</h1>
                    <p className="cart-subtitle">Review your selected items before checkout.</p>
                </div>
                <Link to="/dashboard" className="cart-continue-btn cart-continue-btn--header">
                    Continue shopping
                    <ArrowRight size={15} aria-hidden="true" />
                </Link>
            </header>

            {loading ? (
                <div className="cart-empty-card">
                    <p className="cart-empty-title">Loading your cart...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="cart-empty-card">
                    <p className="cart-empty-title">Your cart is empty.</p>
                    <p className="cart-empty-text">Add some products to get started.</p>
                    <Link to="/dashboard" className="cart-continue-btn cart-continue-btn--empty">
                        Continue shopping
                        <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </div>
            ) : (
                <div className="cart-layout">
                    <section className="cart-items" aria-label="Cart items">
                        {items.map((item, index) => {
                            const isBusy = updatingId === item.id;
                            return (
                                <article
                                    key={item.id}
                                    className="cart-item-card"
                                    style={{ animationDelay: `${Math.min(60 * (index || 0), 240)}ms` }}
                                >
                                    <div className="cart-item-main">
                                        <h2 className="cart-item-name">{item.variant.product.name}</h2>
                                        <p className="cart-item-meta">
                                            {item.variant.color} / {item.variant.size}
                                        </p>
                                    </div>
                                    <div className="cart-item-controls">
                                        <div className="cart-qty" aria-label="Quantity controls">
                                            <button
                                                type="button"
                                                className="cart-qty-btn"
                                                onClick={() => updateQty(item.id, item.quantity - 1)}
                                                disabled={isBusy || item.quantity <= 1}
                                                aria-label="Decrease quantity"
                                            >
                                                <Minus size={14} aria-hidden="true" />
                                            </button>
                                            <span className="cart-qty-value" aria-live="polite">
                                                {item.quantity}
                                            </span>
                                            <button
                                                type="button"
                                                className="cart-qty-btn"
                                                onClick={() => updateQty(item.id, item.quantity + 1)}
                                                disabled={isBusy}
                                                aria-label="Increase quantity"
                                            >
                                                <Plus size={14} aria-hidden="true" />
                                            </button>
                                        </div>
                                        <p className="cart-item-price">
                                            {formatMMK(item.unit_price_mmk)} each
                                            <span className="cart-item-line-total">
                                                {formatMMK(toIntegerMMK(item.quantity) * toIntegerMMK(item.unit_price_mmk))}
                                            </span>
                                        </p>
                                        <button
                                            type="button"
                                            className="cart-remove-btn"
                                            onClick={() => removeItem(item.id)}
                                            disabled={isBusy}
                                        >
                                            <Trash2 size={15} aria-hidden="true" />
                                            Remove
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </section>

                    <aside className="cart-summary-card" aria-label="Order summary">
                        <h2 className="cart-summary-title">Summary</h2>
                        <div className="cart-summary-row">
                            <span>Items</span>
                            <strong>{totalItems}</strong>
                        </div>
                        <div className="cart-summary-row">
                            <span>Subtotal</span>
                            <strong>{formatMMK(subtotalMmk)}</strong>
                        </div>
                        <Link to="/checkout" className="cart-checkout-btn">
                            <CreditCard size={16} aria-hidden="true" />
                            Proceed to checkout
                        </Link>
                    </aside>
                    </div>
            )}
        </div>
    );
}
