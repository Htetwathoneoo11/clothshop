import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { CreditCard, Loader2, ShoppingBag, ChevronLeft, ShieldCheck, Wallet, Landmark } from 'lucide-react';
import { useCart } from '../cart/CartContext.jsx';
import { formatMMK, toIntegerMMK } from '../utils/money.js';

axios.defaults.withCredentials = true;

export default function Checkout() {
    const [items, setItems] = useState([]);
    const [subtotalMmk, setSubtotalMmk] = useState(0);
    const [discountMmk, setDiscountMmk] = useState(0);
    const [totalMmk, setTotalMmk] = useState(0);
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState({ type: '', text: '' });
    const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
    const [deliveryForm, setDeliveryForm] = useState({
        name: '',
        phone_number: '',
        delivery_date: '',
        delivery_time: '',
        building_or_flat: '',
        street_or_road: '',
        township: '',
        city: '',
    });
    const { refreshCartCount } = useCart();

    const totalItems = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        [items]
    );

    useEffect(() => {
        setLoading(true);
        axios
            .get('/api/cart')
            .then((res) => {
                setItems(res.data.items || []);
                setSubtotalMmk(toIntegerMMK(res.data.subtotal_mmk));
                setDiscountMmk(toIntegerMMK(res.data.discount_mmk));
                setTotalMmk(toIntegerMMK(res.data.total_mmk ?? res.data.subtotal_mmk));
                setAppliedCoupon(res.data.applied_coupon || null);
            })
            .catch((err) => {
                if (err.response?.status === 403) {
                    setNotice({
                        type: 'error',
                        text: err.response?.data?.message || 'Access denied.',
                    });
                    setItems([]);
                    setSubtotalMmk(0);
                    setDiscountMmk(0);
                    setTotalMmk(0);
                    setAppliedCoupon(null);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    const handleDeliveryInput = (event) => {
        const { name, value } = event.target;
        setDeliveryForm((prev) => ({ ...prev, [name]: value }));
    };

    const hasMissingDeliveryFields = Object.values(deliveryForm).some((value) => !String(value).trim());

    const handleCheckout = async () => {
        if (hasMissingDeliveryFields) {
            setNotice({
                type: 'error',
                text: 'Please fill in all delivery information fields before confirming checkout.',
            });
            return;
        }

        setBusy(true);
        setNotice({ type: '', text: '' });
        try {
            const res = await axios.post('/api/checkout', {
                ...deliveryForm,
                payment_method: paymentMethod,
            });
            setItems([]);
            setSubtotalMmk(0);
            setDiscountMmk(0);
            setTotalMmk(0);
            setAppliedCoupon(null);
            refreshCartCount();

            if (res.data?.payment_required && res.data?.order_id) {
                setNotice({
                    type: 'success',
                    text: 'Order created. Redirecting to Stripe sandbox checkout...',
                });

                const session = await axios.post(`/api/orders/${res.data.order_id}/stripe-checkout`);
                if (!session.data?.checkout_url) {
                    throw new Error('Stripe checkout URL was not returned.');
                }
                window.location.assign(session.data.checkout_url);
                return;
            }

            setNotice({
                type: 'success',
                text: res.data.message || 'Checkout successful. Your order is now being prepared.',
            });
        } catch (err) {
            setNotice({
                type: 'error',
                text: err.response?.data?.message || err.message || 'Checkout failed. Please try again.',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="checkout-page">
            <header className="checkout-header">
                <div>
                    <p className="checkout-eyebrow">
                        <CreditCard size={14} strokeWidth={2.2} aria-hidden="true" />
                        Secure checkout
                    </p>
                    <h1 className="checkout-title">Review & Place Order</h1>
                    <p className="checkout-subtitle">Confirm your selected items and complete payment.</p>
                </div>
                <Link to="/cart" className="checkout-back-link">
                    <ChevronLeft size={14} aria-hidden="true" />
                    Back to cart
                </Link>
            </header>

            {loading ? (
                <div className="checkout-empty-card">
                    <p className="checkout-empty-title">Loading checkout...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="checkout-empty-card">
                    <p className="checkout-empty-title">Your cart is empty.</p>
                    <p className="checkout-empty-text">Add some products before checking out.</p>
                    <Link to="/dashboard" className="cart-continue-btn cart-continue-btn--empty">
                        Continue shopping
                    </Link>
                </div>
            ) : (
                <div className="checkout-layout">
                    <div className="checkout-main">
                        <section className="checkout-delivery-card" aria-labelledby="checkout-delivery-heading">
                            <h2 id="checkout-delivery-heading" className="checkout-section-title">
                                Delivery information
                            </h2>
                            <p className="checkout-section-subtitle">
                                This information is used to deliver your order to the correct location.
                            </p>
                            <div className="checkout-delivery-grid">
                                <label className="checkout-field">
                                    <span>Name</span>
                                    <input
                                        type="text"
                                        name="name"
                                        value={deliveryForm.name}
                                        onChange={handleDeliveryInput}
                                        autoComplete="name"
                                        placeholder="Enter full name"
                                    />
                                </label>
                                <label className="checkout-field">
                                    <span>Phone number</span>
                                    <input
                                        type="tel"
                                        name="phone_number"
                                        value={deliveryForm.phone_number}
                                        onChange={handleDeliveryInput}
                                        autoComplete="tel"
                                        placeholder="Enter contact number"
                                    />
                                </label>
                                <label className="checkout-field">
                                    <span>Date for delivery</span>
                                    <input
                                        type="date"
                                        name="delivery_date"
                                        value={deliveryForm.delivery_date}
                                        onChange={handleDeliveryInput}
                                    />
                                </label>
                                <label className="checkout-field">
                                    <span>Time for delivery</span>
                                    <input
                                        type="time"
                                        name="delivery_time"
                                        value={deliveryForm.delivery_time}
                                        onChange={handleDeliveryInput}
                                    />
                                </label>
                                <label className="checkout-field">
                                    <span>Building or flat number</span>
                                    <input
                                        type="text"
                                        name="building_or_flat"
                                        value={deliveryForm.building_or_flat}
                                        onChange={handleDeliveryInput}
                                        placeholder="e.g. B12 / Flat 203"
                                    />
                                </label>
                                <label className="checkout-field checkout-field--wide">
                                    <span>Street or road</span>
                                    <input
                                        type="text"
                                        name="street_or_road"
                                        value={deliveryForm.street_or_road}
                                        onChange={handleDeliveryInput}
                                        placeholder="Enter street or road"
                                    />
                                </label>
                                <label className="checkout-field">
                                    <span>Township</span>
                                    <input
                                        type="text"
                                        name="township"
                                        value={deliveryForm.township}
                                        onChange={handleDeliveryInput}
                                        placeholder="Enter township"
                                    />
                                </label>
                                <label className="checkout-field">
                                    <span>City</span>
                                    <input
                                        type="text"
                                        name="city"
                                        value={deliveryForm.city}
                                        onChange={handleDeliveryInput}
                                        placeholder="Enter city"
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="checkout-payment-card" aria-labelledby="checkout-payment-heading">
                            <h2 id="checkout-payment-heading" className="checkout-section-title">
                                Payment method
                            </h2>
                            <p className="checkout-section-subtitle">
                                Choose your preferred payment option for this order.
                            </p>
                            <div className="checkout-payment-options" role="radiogroup" aria-label="Payment method">
                                <label className="checkout-payment-option">
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="cash_on_delivery"
                                        checked={paymentMethod === 'cash_on_delivery'}
                                        onChange={(event) => setPaymentMethod(event.target.value)}
                                    />
                                    <span className="checkout-payment-option-content">
                                        <Wallet size={16} aria-hidden="true" />
                                        Cash on delivery
                                    </span>
                                </label>
                                <label className="checkout-payment-option">
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="card_on_delivery"
                                        checked={paymentMethod === 'card_on_delivery'}
                                        onChange={(event) => setPaymentMethod(event.target.value)}
                                    />
                                    <span className="checkout-payment-option-content">
                                        <CreditCard size={16} aria-hidden="true" />
                                        Card on delivery
                                    </span>
                                </label>
                                <label className="checkout-payment-option">
                                    <input
                                        type="radio"
                                        name="payment_method"
                                        value="stripe_checkout"
                                        checked={paymentMethod === 'stripe_checkout'}
                                        onChange={(event) => setPaymentMethod(event.target.value)}
                                    />
                                    <span className="checkout-payment-option-content">
                                        <Landmark size={16} aria-hidden="true" />
                                        <span>
                                            Stripe sandbox
                                            <small>Pay online with Stripe test cards.</small>
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </section>
                    </div>

                    <aside className="checkout-summary-card" aria-label="Order summary">
                        <h2 className="checkout-summary-title">Order summary</h2>
                        <section className="checkout-items checkout-items--summary" aria-label="Checkout items">
                            {items.map((item, index) => (
                                <article
                                    key={item.id}
                                    className="checkout-item-card"
                                    style={{ animationDelay: `${Math.min(60 * (index || 0), 240)}ms` }}
                                >
                                    <div className="checkout-item-main">
                                        <h3 className="checkout-item-name">{item.variant.product.name}</h3>
                                        <p className="checkout-item-meta">
                                            {item.variant.color} / {item.variant.size}
                                        </p>
                                    </div>
                                    <div className="checkout-item-price">
                                        <span>{item.quantity} x {formatMMK(item.unit_price_mmk)}</span>
                                        <strong>{formatMMK(toIntegerMMK(item.quantity) * toIntegerMMK(item.unit_price_mmk))}</strong>
                                    </div>
                                </article>
                            ))}
                        </section>
                        <div className="checkout-summary-row">
                            <span>Items</span>
                            <strong>{totalItems}</strong>
                        </div>
                        <div className="checkout-summary-row">
                            <span>Subtotal</span>
                            <strong>{formatMMK(subtotalMmk)}</strong>
                        </div>
                        {appliedCoupon && discountMmk > 0 ? (
                            <div className="checkout-summary-row checkout-summary-row--discount">
                                <span>{appliedCoupon.code}</span>
                                <strong>-{formatMMK(discountMmk)}</strong>
                            </div>
                        ) : null}
                        <div className="checkout-summary-row checkout-summary-row--total">
                            <span>Total</span>
                            <strong>{formatMMK(totalMmk || subtotalMmk)}</strong>
                        </div>
                        <div className="checkout-secure-note">
                            <ShieldCheck size={15} aria-hidden="true" />
                            Secure checkout and stock verified before confirmation.
                        </div>
                        <button
                            className="checkout-confirm-btn"
                            onClick={handleCheckout}
                            disabled={busy}
                        >
                            {busy ? (
                                <>
                                    <Loader2 size={16} className="checkout-spinner" aria-hidden="true" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ShoppingBag size={16} aria-hidden="true" />
                                    {paymentMethod === 'stripe_checkout' ? 'Continue to Stripe' : 'Confirm Checkout'}
                                </>
                            )}
                        </button>
                    </aside>
                </div>
            )}

            {notice.text ? (
                <p className={`checkout-notice checkout-notice--${notice.type || 'info'}`} role="status">
                    {notice.text}
                </p>
            ) : null}
        </div>
    );
}
