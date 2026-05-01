import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { formatMMK } from '../utils/money.js';

axios.defaults.withCredentials = true;

export default function StripeReturn({ cancelled = false }) {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('session_id');
    const orderId = params.get('order_id');
    const [status, setStatus] = useState(cancelled ? 'cancelled' : 'loading');
    const [message, setMessage] = useState(cancelled ? 'Stripe checkout was cancelled. Your order is still awaiting payment.' : '');
    const [order, setOrder] = useState(null);

    useEffect(() => {
        let active = true;

        if (cancelled) {
            if (orderId) {
                axios.get(`/api/orders/${orderId}`)
                    .then((res) => {
                        if (active) setOrder(res.data?.order || null);
                    })
                    .catch(() => {});
            }
            return () => {
                active = false;
            };
        }

        if (!sessionId) {
            setStatus('error');
            setMessage('Stripe did not return a checkout session.');
            return () => {
                active = false;
            };
        }

        axios.post('/api/orders/stripe-confirm', { session_id: sessionId })
            .then((res) => {
                if (!active) return;
                const nextOrder = res.data?.order || null;
                setOrder(nextOrder);
                setStatus(nextOrder?.status === 'paid' ? 'success' : 'pending');
                setMessage(res.data?.message || 'Payment status checked.');
            })
            .catch((err) => {
                if (!active) return;
                setStatus('error');
                setMessage(err.response?.data?.message || 'Could not confirm the Stripe payment.');
            });

        return () => {
            active = false;
        };
    }, [cancelled, orderId, sessionId]);

    const icon = status === 'loading'
        ? <Loader2 size={34} className="checkout-spinner" aria-hidden="true" />
        : status === 'success'
            ? <CheckCircle2 size={34} aria-hidden="true" />
            : <XCircle size={34} aria-hidden="true" />;

    return (
        <div className="checkout-page">
            <div className={`stripe-return-card stripe-return-card--${status}`}>
                {icon}
                <p className="checkout-eyebrow">Stripe sandbox</p>
                <h1 className="checkout-title">
                    {status === 'success' ? 'Payment confirmed' : status === 'loading' ? 'Checking payment' : 'Payment not completed'}
                </h1>
                <p className="checkout-subtitle">{message}</p>

                {order ? (
                    <div className="stripe-return-summary">
                        <div>
                            <span>Order</span>
                            <strong>#{order.id}</strong>
                        </div>
                        <div>
                            <span>Status</span>
                            <strong>{order.status}</strong>
                        </div>
                        <div>
                            <span>Total</span>
                            <strong>{formatMMK(order.total_amount_mmk)}</strong>
                        </div>
                    </div>
                ) : null}

                <div className="stripe-return-actions">
                    <Link to="/profile" className="checkout-confirm-btn">View order</Link>
                    <Link to="/dashboard" className="checkout-back-link">Continue shopping</Link>
                </div>
            </div>
        </div>
    );
}
