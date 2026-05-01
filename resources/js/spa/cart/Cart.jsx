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
    const [discountMmk, setDiscountMmk] = useState(0);
    const [totalMmk, setTotalMmk] = useState(0);
    const [availableCoupons, setAvailableCoupons] = useState([]);
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponCode, setCouponCode] = useState('');
    const [couponMessage, setCouponMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const { refreshCartCount } = useCart();

    const loadCart = () => {
        setLoading(true);
        setError('');
        axios
            .get('/api/cart')
            .then((res) => {
                setItems(res.data.items || []);
                setSubtotalMmk(toIntegerMMK(res.data.subtotal_mmk));
                setDiscountMmk(toIntegerMMK(res.data.discount_mmk));
                setTotalMmk(toIntegerMMK(res.data.total_mmk ?? res.data.subtotal_mmk));
                setAvailableCoupons(res.data.available_coupons || []);
                setAppliedCoupon(res.data.applied_coupon || null);
                setCouponCode(res.data.applied_coupon?.code || '');
                refreshCartCount();
            })
            .catch((err) => {
                if (err.response?.status === 403) {
                    setError(err.response?.data?.message || 'Access denied.');
                    setItems([]);
                    setSubtotalMmk(0);
                    setDiscountMmk(0);
                    setTotalMmk(0);
                }
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

    const applyCoupon = (event) => {
        event.preventDefault();
        const code = couponCode.trim();
        if (!code) {
            setCouponMessage({ type: 'error', text: 'Enter a coupon code.' });
            return;
        }

        setUpdatingId('coupon');
        setCouponMessage({ type: '', text: '' });
        axios
            .post('/api/cart/coupon', { code })
            .then((res) => {
                setCouponMessage({ type: 'success', text: res.data?.message || 'Coupon applied.' });
                loadCart();
            })
            .catch((err) => {
                setCouponMessage({
                    type: 'error',
                    text: err.response?.data?.message || 'Coupon could not be applied.',
                });
            })
            .finally(() => setUpdatingId(null));
    };

    const removeCoupon = () => {
        setUpdatingId('coupon');
        setCouponMessage({ type: '', text: '' });
        axios
            .delete('/api/cart/coupon')
            .then((res) => {
                setCouponMessage({ type: 'success', text: res.data?.message || 'Coupon removed.' });
                loadCart();
            })
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
            ) : error ? (
                <div className="cart-empty-card">
                    <p className="cart-empty-title">{error}</p>
                    <p className="cart-empty-text">Admin accounts can preview products but cannot place orders.</p>
                    <Link to="/dashboard" className="cart-continue-btn cart-continue-btn--empty">
                        Continue browsing
                        <ArrowRight size={15} aria-hidden="true" />
                    </Link>
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
                        <div className="cart-coupon-box">
                            <p className="cart-coupon-title">Coupon</p>
                            {availableCoupons.length > 0 ? (
                                <div className="cart-coupon-list">
                                    {availableCoupons.map((coupon) => (
                                        <button
                                            type="button"
                                            key={coupon.id}
                                            className="cart-coupon-chip"
                                            onClick={() => setCouponCode(coupon.code)}
                                        >
                                            {coupon.code} · {coupon.discount_percent}% off
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="cart-coupon-help">Reach 500,000 MMK credit score to unlock 10% off.</p>
                            )}
                            <form className="cart-coupon-form" onSubmit={applyCoupon}>
                                <input
                                    type="text"
                                    value={couponCode}
                                    onChange={(event) => {
                                        setCouponCode(event.target.value);
                                        if (couponMessage.text) setCouponMessage({ type: '', text: '' });
                                    }}
                                    placeholder="Coupon code"
                                    disabled={updatingId === 'coupon'}
                                />
                                <button type="submit" disabled={updatingId === 'coupon'}>
                                    Apply
                                </button>
                            </form>
                            {appliedCoupon ? (
                                <div className="cart-coupon-applied">
                                    <span>{appliedCoupon.code} applied</span>
                                    <button type="button" onClick={removeCoupon} disabled={updatingId === 'coupon'}>
                                        Remove
                                    </button>
                                </div>
                            ) : null}
                            {couponMessage.text ? (
                                <p className={`cart-coupon-message cart-coupon-message--${couponMessage.type || 'info'}`}>
                                    {couponMessage.text}
                                </p>
                            ) : null}
                        </div>
                        {discountMmk > 0 ? (
                            <div className="cart-summary-row cart-summary-row--discount">
                                <span>Discount</span>
                                <strong>-{formatMMK(discountMmk)}</strong>
                            </div>
                        ) : null}
                        <div className="cart-summary-row cart-summary-row--total">
                            <span>Total</span>
                            <strong>{formatMMK(totalMmk)}</strong>
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
