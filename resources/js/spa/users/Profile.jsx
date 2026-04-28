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
} from 'lucide-react';

import { formatMMK } from '../utils/money.js';
import { emitAuthChange } from '../utils/authEvents.js';

axios.defaults.withCredentials = true;

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
    if (role === 2) return 'Admin';
    return 'User';
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
    const fileRef = useRef(null);
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
            })
            .catch((err) => {
                if (err.response?.status === 401) {
                    navigate('/login', { replace: true });
                }
            })
            .finally(() => setLoading(false));
    }, [navigate]);

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
        emitAuthChange('logout');
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
                    </div>
                </div>
            </section>

            <div className="profile-layout">
                <div className="profile-main">
                    {!user.has_verified_email ? (
                        <section className="profile-verify-card" aria-labelledby="verify-email-heading">
                            <div className="profile-verify-icon" aria-hidden="true">
                                <Mail size={20} />
                            </div>
                            <div className="profile-verify-copy">
                                <h3 id="verify-email-heading">Verify your email</h3>
                                <p>Verify {user.email} to unlock checkout and keep your account secure.</p>
                            </div>
                            <Link to="/verify-email-code" state={{ email: user.email }} className="profile-verify-action">
                                Verify email
                            </Link>
                        </section>
                    ) : null}

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
                                <dt>Email status</dt>
                                <dd>
                                    {user.has_verified_email ? (
                                        <span className="profile-badge profile-badge--ok">Verified</span>
                                    ) : (
                                        <span className="profile-status-unverified">Not verified</span>
                                    )}
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
