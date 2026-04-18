import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import {
    User,
    Mail,
    LogOut,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    CreditCard,
    ChevronRight,
    Loader2,
    Camera,
    Trash2,
    Package,
    X,
} from 'lucide-react';

import { formatMMK } from '../utils/money.js';

axios.defaults.withCredentials = true;

/** Matches SVG arc: M 12 56 A 44 44 0 0 0 108 56 */
const CREDIT_ARC_LEN = 44 * Math.PI;

function formatDateTime(iso) {
    if (!iso) return '—';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(iso)
        );
    } catch {
        return '—';
    }
}

function orderStatusLabel(status) {
    switch (status) {
        case 'paid':
            return 'Completed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return status;
    }
}

function initialsFromUser(user) {
    if (!user?.username) return '?';
    const parts = String(user.username).trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return String(user.username).slice(0, 2).toUpperCase();
}

function roleLabel(role) {
    if (role === 1) return 'Member';
    if (role === 2) return 'Shopkeeper';
    return `Role ${role}`;
}

function statusLabel(status) {
    return status === 1 ? 'Active' : 'Restricted';
}

export default function Profile() {
    const [user, setUser] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logoutBusy, setLogoutBusy] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarError, setAvatarError] = useState('');
    const [imgBroken, setImgBroken] = useState(false);
    const [applyBusy, setApplyBusy] = useState(false);
    const [applyMessage, setApplyMessage] = useState('');
    const [applyError, setApplyError] = useState('');
    const [creditOpen, setCreditOpen] = useState(false);
    const fileRef = useRef(null);
    const creditCloseRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        axios
            .get('/api/me')
            .then((res) => {
                if (!res.data.user) {
                    navigate('/login', { replace: true });
                    return;
                }
                setUser(res.data.user);
                setApplyMessage('');
                setApplyError('');
            })
            .catch((err) => {
                if (err.response?.status === 401) {
                    navigate('/login', { replace: true });
                }
            })
            .finally(() => setLoading(false));
    }, [navigate]);

    const handleApplyShopkeeper = async () => {
        setApplyBusy(true);
        setApplyMessage('');
        setApplyError('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post('/api/shopkeeper/apply');
            setApplyMessage(res.data.message || 'Request completed.');
            setUser(res.data.user);
        } catch (err) {
            const data = err.response?.data;
            const msg =
                (typeof data?.message === 'string' && data.message) ||
                'Could not submit application. Please try again.';
            setApplyError(msg);
            if (data?.user) {
                setUser(data.user);
            }
        } finally {
            setApplyBusy(false);
        }
    };

    useEffect(() => {
        if (!user) return;
        axios
            .get('/api/orders')
            .then((res) => setOrders(res.data.orders || []))
            .catch(() => setOrders([]));
    }, [user]);

    useEffect(() => {
        setImgBroken(false);
    }, [user?.avatar_url]);

    const initials = useMemo(() => initialsFromUser(user), [user]);

    const eligibility = user?.shopkeeper_eligibility || {};
    const creditScore = Number(user?.credit_score ?? 0);
    const shopkeeperThreshold = Number(eligibility.threshold ?? 0);
    const remainingCredit = Number(eligibility.remaining_credit ?? 0);
    const canApply =
        !user?.is_shopkeeper &&
        eligibility.eligible === true;
    const progressPct =
        shopkeeperThreshold > 0
            ? Math.min(100, Math.round((creditScore / shopkeeperThreshold) * 100))
            : 0;

    const meterDisplayPct = user?.is_shopkeeper ? 100 : progressPct;
    const meterVisualPct = user?.is_shopkeeper ? 100 : Math.max(6, progressPct);

    useEffect(() => {
        if (!creditOpen) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setCreditOpen(false);
        };
        document.addEventListener('keydown', onKey);
        const t = window.setTimeout(() => creditCloseRef.current?.focus(), 0);
        return () => {
            document.removeEventListener('keydown', onKey);
            window.clearTimeout(t);
        };
    }, [creditOpen]);

    const handleLogout = async () => {
        setLogoutBusy(true);
        try {
            await axios.get('/sanctum/csrf-cookie');
            await axios.post('/api/auth/logout');
        } catch {
            /* still navigate away */
        } finally {
            setLogoutBusy(false);
        }
        navigate('/login');
    };

    const handleAvatarPick = () => fileRef.current?.click();

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarBusy(true);
        setAvatarError('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const fd = new FormData();
            fd.append('avatar', file);
            const res = await axios.post('/api/me/avatar', fd);
            setUser(res.data.user);
        } catch (err) {
            const data = err.response?.data;
            const fromField = data?.errors?.avatar?.[0];
            const msg = data?.message;
            setAvatarError(
                (typeof fromField === 'string' && fromField.trim() && fromField) ||
                    (typeof msg === 'string' && msg.trim() && msg) ||
                    'Could not upload your photo. Try a smaller JPG or PNG (max about 4.4 MB).'
            );
        } finally {
            setAvatarBusy(false);
            e.target.value = '';
        }
    };

    const handleRemoveAvatar = async () => {
        setAvatarBusy(true);
        setAvatarError('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.delete('/api/me/avatar');
            setUser(res.data.user);
        } catch {
            setAvatarError('Could not remove your photo.');
        } finally {
            setAvatarBusy(false);
        }
    };

    if (loading || !user) {
        return null;
    }

    const showPhoto = Boolean(user.avatar_url) && !imgBroken;

    return (
        <div className="profile-page">
            <header className="profile-header">
                <h1 className="profile-title">Profile</h1>
            </header>

            <section className="profile-hero" aria-labelledby="profile-hero-heading">
                <div className="profile-hero-bg" aria-hidden="true" />
                <div className="profile-hero-inner">
                    <div className="profile-hero-main-row">
                        <div className="profile-avatar-wrap">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                className="profile-photo-input"
                                onChange={handleAvatarChange}
                                disabled={avatarBusy}
                                aria-label="Choose profile photo"
                            />
                            <button
                                type="button"
                                className={`profile-avatar ${showPhoto ? 'profile-avatar--photo' : ''} profile-avatar--interactive`}
                                onClick={handleAvatarPick}
                                disabled={avatarBusy}
                                aria-label={showPhoto ? 'Change profile photo' : 'Add profile photo'}
                            >
                                {avatarBusy ? (
                                    <Loader2
                                        size={28}
                                        className="profile-avatar-busy profile-sign-out-spinner"
                                        aria-hidden="true"
                                    />
                                ) : showPhoto ? (
                                    <img
                                        src={user.avatar_url}
                                        alt=""
                                        className="profile-avatar-img"
                                        onError={() => setImgBroken(true)}
                                    />
                                ) : (
                                    <span className="profile-avatar-text">{initials}</span>
                                )}
                                {!avatarBusy ? (
                                    <span className="profile-avatar-edit-hint" aria-hidden="true">
                                        <Camera size={20} strokeWidth={2} />
                                    </span>
                                ) : null}
                            </button>
                            {showPhoto && !avatarBusy ? (
                                <button
                                    type="button"
                                    className="profile-avatar-remove"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveAvatar();
                                    }}
                                    disabled={avatarBusy}
                                    aria-label="Remove profile photo"
                                >
                                    <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                                </button>
                            ) : null}
                        </div>
                        <div className="profile-hero-text">
                        <h2 id="profile-hero-heading" className="profile-display-name">
                            {user.username}
                        </h2>
                        <p className="profile-email">{user.email}</p>
                        <div className="profile-badges">
                            <span className="profile-badge profile-badge--role">
                                <ShieldCheck size={14} aria-hidden="true" />
                                {roleLabel(user.role)}
                            </span>
                            <span
                                className={`profile-badge profile-badge--status${user.status === 1 ? ' profile-badge--ok' : ''}`}
                            >
                                {statusLabel(user.status)}
                            </span>
                        </div>
                        {avatarError ? (
                            <p className="profile-photo-error" role="alert">
                                {avatarError}
                            </p>
                        ) : null}
                        </div>

                        <aside className="profile-credit-corner" aria-label="Shopkeeper credit">
                            <div className="profile-credit-arc-wrap">
                                <svg className="profile-credit-arc-svg" viewBox="0 0 120 64" aria-hidden="true">
                                    <defs>
                                        <linearGradient id="credit-arc-prog" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#f97316" />
                                            <stop offset="50%" stopColor="#fb923c" />
                                            <stop offset="100%" stopColor="#fdba74" />
                                        </linearGradient>
                                        <linearGradient id="credit-arc-prog-complete" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#22c55e" />
                                            <stop offset="100%" stopColor="#86efac" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d="M 12 56 A 44 44 0 0 0 108 56"
                                        fill="none"
                                        stroke="rgba(0,0,0,0.35)"
                                        strokeWidth="11"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M 12 56 A 44 44 0 0 0 108 56"
                                        fill="none"
                                        stroke="rgba(255,255,255,0.38)"
                                        strokeWidth="9"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M 12 56 A 44 44 0 0 0 108 56"
                                        fill="none"
                                        stroke={
                                            user?.is_shopkeeper
                                                ? 'url(#credit-arc-prog-complete)'
                                                : 'url(#credit-arc-prog)'
                                        }
                                        strokeWidth="9"
                                        strokeLinecap="round"
                                        strokeDasharray={`${(meterVisualPct / 100) * CREDIT_ARC_LEN} ${CREDIT_ARC_LEN}`}
                                        className={`profile-credit-arc-prog${
                                            user?.is_shopkeeper ? ' profile-credit-arc-prog--complete' : ''
                                        }`}
                                    />
                                </svg>
                                <span className="profile-credit-arc-pct">{meterDisplayPct}%</span>
                            </div>
                            <button
                                type="button"
                                className="profile-credit-corner-btn"
                                onClick={() => setCreditOpen(true)}
                                aria-haspopup="dialog"
                            >
                                Credit
                            </button>
                        </aside>
                    </div>

                    {applyMessage ? (
                        <p className="profile-hero-credit-notice profile-hero-credit-notice--success" role="status">
                            {applyMessage}
                        </p>
                    ) : null}
                    {applyError ? (
                        <p className="profile-hero-credit-notice profile-hero-credit-notice--error" role="alert">
                            {applyError}
                        </p>
                    ) : null}
                </div>
            </section>

            {creditOpen ? (
                <div className="profile-credit-modal-root">
                    <div
                        className="profile-credit-modal-backdrop"
                        role="presentation"
                        onClick={() => setCreditOpen(false)}
                    />
                    <div
                        className="profile-credit-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="credit-modal-title"
                    >
                        <div className="profile-credit-modal-head">
                            <h2 id="credit-modal-title" className="profile-credit-modal-title">
                                Shopkeeper credit
                            </h2>
                            <button
                                ref={creditCloseRef}
                                type="button"
                                className="profile-credit-modal-close"
                                onClick={() => setCreditOpen(false)}
                                aria-label="Close"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        </div>

                        <p className="profile-credit-modal-lede">
                            Your credit from completed orders counts toward the Shopkeeper threshold.
                        </p>

                        <dl className="profile-credit-modal-dl">
                            <div className="profile-credit-modal-dl-row">
                                <dt>Your credit</dt>
                                <dd>{formatMMK(creditScore)}</dd>
                            </div>
                            <div className="profile-credit-modal-dl-row">
                                <dt>Threshold</dt>
                                <dd>{formatMMK(shopkeeperThreshold)}</dd>
                            </div>
                            {!user?.is_shopkeeper ? (
                                <div className="profile-credit-modal-dl-row">
                                    <dt>Remaining</dt>
                                    <dd>{formatMMK(remainingCredit)}</dd>
                                </div>
                            ) : null}
                        </dl>

                        <div
                            className={`profile-credit-modal-callout${
                                user?.is_shopkeeper
                                    ? ' profile-credit-modal-callout--ok'
                                    : eligibility.eligible
                                      ? ' profile-credit-modal-callout--ok'
                                      : ' profile-credit-modal-callout--muted'
                            }`}
                        >
                            {user?.is_shopkeeper ? (
                                <p>You have the Shopkeeper role. Credit still reflects your purchase history.</p>
                            ) : eligibility.eligible ? (
                                <p>You meet the threshold and can apply for Shopkeeper below.</p>
                            ) : (
                                <p>
                                    Keep shopping — when your credit reaches the threshold, you can apply to become a
                                    Shopkeeper.
                                </p>
                            )}
                        </div>

                        <p className="profile-credit-modal-footnote">
                            You earn <strong>1 credit per 1 MMK</strong> from completed paid orders.
                        </p>

                        {!user?.is_shopkeeper ? (
                            <div className="profile-credit-modal-actions">
                                <button
                                    type="button"
                                    className="profile-credit-modal-apply"
                                    onClick={handleApplyShopkeeper}
                                    disabled={applyBusy || !canApply}
                                >
                                    {applyBusy ? (
                                        <>
                                            <Loader2 size={16} className="profile-sign-out-spinner" aria-hidden="true" />
                                            Applying…
                                        </>
                                    ) : (
                                        'Apply for Shopkeeper'
                                    )}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="profile-layout">
                <div className="profile-main">
                    <section className="profile-card" aria-labelledby="account-heading">
                        <h3 id="account-heading" className="profile-card-title">
                            <User size={18} strokeWidth={2} aria-hidden="true" />
                            Account details
                        </h3>
                        <dl className="profile-dl">
                            <div className="profile-dl-row">
                                <dt>Username</dt>
                                <dd>{user.username}</dd>
                            </div>
                            <div className="profile-dl-row">
                                <dt>Email</dt>
                                <dd>
                                    <span className="profile-dl-with-icon">
                                        <Mail size={16} aria-hidden="true" />
                                        {user.email}
                                    </span>
                                </dd>
                            </div>
                            <div className="profile-dl-row">
                                <dt>Member since</dt>
                                <dd>{formatDateTime(user.created_at)}</dd>
                            </div>
                        </dl>
                    </section>

                    <section className="profile-card" aria-labelledby="orders-heading">
                        <h3 id="orders-heading" className="profile-card-title">
                            <Package size={18} strokeWidth={2} aria-hidden="true" />
                            Order history
                        </h3>
                        {orders.length === 0 ? (
                            <p className="profile-orders-empty">
                                No completed orders yet. When you check out, your purchases will appear here.
                            </p>
                        ) : (
                            <ul className="profile-orders-list">
                                {orders.map((order) => (
                                    <li key={order.id} className="profile-order">
                                        <div className="profile-order-head">
                                            <div>
                                                <span className="profile-order-id">Order #{order.id}</span>
                                                <span className="profile-order-date">
                                                    {formatDateTime(order.created_at)}
                                                </span>
                                            </div>
                                            <div className="profile-order-meta">
                                                <span
                                                    className={`profile-order-status profile-order-status--${order.status}`}
                                                >
                                                    {orderStatusLabel(order.status)}
                                                </span>
                                                <span className="profile-order-total">
                                                    {formatMMK(order.total_amount_mmk)}
                                                </span>
                                            </div>
                                        </div>
                                        <ul className="profile-order-lines">
                                            {order.items.map((line, idx) => (
                                                <li key={`${order.id}-${idx}`} className="profile-order-line">
                                                    <div className="profile-order-line-top">
                                                        <span className="profile-order-line-name">{line.product_name}</span>
                                                        <span className="profile-order-line-price">
                                                            {formatMMK(line.line_total_mmk)}
                                                        </span>
                                                    </div>
                                                    <div className="profile-order-line-sub">
                                                        <span>
                                                            {[line.color, line.size].filter(Boolean).join(' · ') || '—'}
                                                        </span>
                                                        <span className="profile-order-line-qty">×{line.quantity}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <aside className="profile-aside" aria-label="Quick actions">
                    <div className="profile-card profile-card--sticky">
                        <h3 className="profile-card-title profile-card-title--plain">Quick links</h3>
                        <nav className="profile-quick-nav" aria-label="Shopping shortcuts">
                            <Link className="profile-quick-link" to="/dashboard">
                                <ShoppingBag size={18} aria-hidden="true" />
                                <span>Continue shopping</span>
                                <ChevronRight size={18} className="profile-quick-chevron" aria-hidden="true" />
                            </Link>
                            <Link className="profile-quick-link" to="/cart">
                                <ShoppingCart size={18} aria-hidden="true" />
                                <span>View cart</span>
                                <ChevronRight size={18} className="profile-quick-chevron" aria-hidden="true" />
                            </Link>
                            <Link className="profile-quick-link" to="/checkout">
                                <CreditCard size={18} aria-hidden="true" />
                                <span>Checkout</span>
                                <ChevronRight size={18} className="profile-quick-chevron" aria-hidden="true" />
                            </Link>
                        </nav>
                        <button
                            type="button"
                            className="profile-sign-out"
                            onClick={handleLogout}
                            disabled={logoutBusy}
                        >
                            {logoutBusy ? (
                                <>
                                    <Loader2 size={18} className="profile-sign-out-spinner" aria-hidden="true" />
                                    Signing out…
                                </>
                            ) : (
                                <>
                                    <LogOut size={18} aria-hidden="true" />
                                    Sign out
                                </>
                            )}
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}
