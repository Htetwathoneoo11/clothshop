import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import {
    Activity,
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
    Gift,
    BadgePercent,
    BarChart3,
    Bell,
    Box,
    ClipboardList,
    Gauge,
    LayoutPanelTop,
    Warehouse,
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
        case 'pending':
            return 'Awaiting payment';
        case 'paid':
            return 'Completed';
        case 'cancelled':
            return 'Cancelled';
        case 'failed':
            return 'Payment failed';
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
    if (role === 2) return 'Super Admin';
    if (role === 3) return 'Manager';
    if (role === 4) return 'Support';
    if (role === 5) return 'Inventory Admin';
    return 'User';
}

function statusLabel(status) {
    return status === 1 ? 'Active' : 'Restricted';
}

function couponStatusLabel(status) {
    switch (status) {
        case 'available':
            return 'Available';
        case 'used':
            return 'Used';
        case 'expired':
            return 'Expired';
        default:
            return status || 'Unknown';
    }
}

const ADMIN_PERMISSION_LABELS = [
    ['manage_users', 'Users and staff'],
    ['manage_orders', 'Orders'],
    ['manage_catalog', 'Catalog'],
    ['manage_inventory', 'Inventory'],
    ['manage_marketing', 'Marketing boards'],
    ['manage_loyalty', 'Coupons and loyalty'],
    ['view_audit', 'Audit logs'],
    ['view_reports', 'Reports'],
    ['view_notifications', 'Notifications'],
];

const ADMIN_QUICK_LINKS = [
    ['Admin dashboard', '/admin', Gauge],
    ['Orders', '/admin/orders', ClipboardList, 'manage_orders'],
    ['Users and staff', '/admin/users', User, 'manage_users'],
    ['Audit logs', '/admin/audit-logs', Activity, 'view_audit'],
    ['Coupons', '/admin/coupons', BadgePercent, 'manage_loyalty'],
    ['Inventory', '/admin/inventory', Warehouse, 'manage_inventory'],
    ['Reports', '/admin/reports', BarChart3, 'view_reports'],
    ['Notifications', '/admin/notifications', Bell, 'view_notifications'],
    ['Products', '/admin/products', Box, 'manage_catalog'],
    ['Boards', '/admin/boards', LayoutPanelTop, 'manage_marketing'],
];

export default function Profile() {
    const [user, setUser] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logoutBusy, setLogoutBusy] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarError, setAvatarError] = useState('');
    const [imgBroken, setImgBroken] = useState(false);
    const [loyaltyOpen, setLoyaltyOpen] = useState(false);
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
    const loyalty = user.loyalty || {};
    const creditScore = Number(user.credit_score || 0);
    const thresholdMmk = Number(loyalty.threshold_mmk || 500000);
    const remainingMmk = Number(loyalty.remaining_mmk ?? Math.max(0, thresholdMmk - creditScore));
    const progressPercent = Math.max(0, Math.min(100, Number(loyalty.progress_percent || 0)));
    const activeCoupon = loyalty.coupon;
    const activeCoupons = Array.isArray(loyalty.coupons) ? loyalty.coupons : activeCoupon ? [activeCoupon] : [];
    const couponHistory = Array.isArray(loyalty.coupon_history) ? loyalty.coupon_history : [];
    const nextReward = loyalty.next_reward;
    const isAdmin = Boolean(user.is_admin);
    const can = (permission) => Boolean(user.permissions?.[permission] ?? isAdmin);

    return (
        <div className="profile-page">
            <header className="profile-header">
                <p className="profile-eyebrow">{isAdmin ? 'Admin account' : 'Customer account'}</p>
                <h1 className="profile-title">{isAdmin ? 'Admin profile' : 'Profile'}</h1>
                <p className="profile-lede">
                    {isAdmin
                        ? 'Review your admin role, permissions, and admin shortcuts.'
                        : 'Review your account, rewards, and recent orders.'}
                </p>
            </header>

            <section className="profile-hero" aria-labelledby="profile-hero-heading">
                <div className="profile-hero-bg" aria-hidden="true" />
                <div className="profile-hero-inner">
                    <div className="profile-hero-main-row">
                        <div className="profile-hero-identity">
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
                        {isAdmin ? (
                            <Link to="/admin" className="profile-hero-admin-meter">
                                <span className="profile-hero-admin-icon" aria-hidden="true">
                                    <Gauge size={24} />
                                </span>
                                <span className="profile-hero-meter-copy">
                                    <span>Admin access</span>
                                    <strong>{user.role_label || roleLabel(user.role)}</strong>
                                    <small>Open dashboard</small>
                                </span>
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className={`profile-hero-credit-meter${activeCoupon ? ' profile-hero-credit-meter--ready' : ''}`}
                                onClick={() => setLoyaltyOpen((state) => !state)}
                                aria-expanded={loyaltyOpen}
                                aria-controls="profile-loyalty-alert"
                                aria-label="Show loyalty reward details"
                            >
                                <span
                                    className="profile-hero-meter-ring"
                                    style={{ '--loyalty-progress': progressPercent }}
                                    aria-hidden="true"
                                >
                                    <span>{progressPercent}%</span>
                                </span>
                                <span className="profile-hero-meter-copy">
                                    <span>Credit score</span>
                                    <strong>{formatMMK(creditScore)}</strong>
                                    <small>View reward</small>
                                </span>
                            </button>
                        )}
                    </div>
                    {loyaltyOpen && !isAdmin ? (
                        <div
                            id="profile-loyalty-alert"
                            className={`profile-loyalty-popover${activeCoupon ? ' profile-loyalty-popover--ready' : ''}`}
                            role="alert"
                        >
                            <button
                                type="button"
                                className="profile-loyalty-popover-close"
                                onClick={() => setLoyaltyOpen(false)}
                                aria-label="Close loyalty reward message"
                            >
                                x
                            </button>
                            <div className="profile-loyalty-alert-icon" aria-hidden="true">
                                {activeCoupon ? <BadgePercent size={20} /> : <Gift size={20} />}
                            </div>
                            <div className="profile-loyalty-alert-copy">
                                <strong>{activeCoupon ? 'Your loyalty coupon is ready.' : 'Keep building credit for a reward.'}</strong>
                                <p>
                                    {activeCoupon
                                        ? `${activeCoupon.code} gives ${activeCoupon.discount_percent}% off your cart. Paid orders build credit; each reward tier gives one coupon only.`
                                        : `Reach ${formatMMK(thresholdMmk)} to unlock a one-time ${nextReward?.discount_percent || 10}% cart coupon. ${formatMMK(remainingMmk)} remaining.`}
                                </p>
                                <p className="profile-loyalty-alert-note">
                                    Pending or failed payments do not increase credit score. Coupons are single-use and can be applied in the cart.
                                </p>
                            </div>
                            {activeCoupon ? (
                                <Link to="/cart" className="profile-loyalty-alert-action">
                                    Use in cart
                                </Link>
                            ) : null}
                        </div>
                    ) : null}
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
                                <dt>Credit score</dt>
                                <dd>{isAdmin ? 'Not used for admin accounts' : formatMMK(user.credit_score || 0)}</dd>
                            </div>
                            <div className="profile-dl-row">
                                <dt>Member since</dt>
                                <dd>{formatDateTime(user.created_at)}</dd>
                            </div>
                        </dl>
                    </section>

                    {isAdmin ? (
                        <section className="profile-card" aria-labelledby="admin-access-heading">
                            <h3 id="admin-access-heading" className="profile-card-title">
                                <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
                                Admin access
                            </h3>
                            <div className="profile-admin-role-card">
                                <span>{user.role_label || roleLabel(user.role)}</span>
                                <strong>{Object.values(user.permissions || {}).filter(Boolean).length} active permissions</strong>
                                <p>Permissions are managed from the central admin role matrix.</p>
                            </div>
                            <div className="profile-admin-permission-grid">
                                {ADMIN_PERMISSION_LABELS.map(([key, label]) => (
                                    <span
                                        key={key}
                                        className={`profile-admin-permission ${can(key) ? 'profile-admin-permission--yes' : 'profile-admin-permission--no'}`}
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <>
                    <section className="profile-card" aria-labelledby="coupon-history-heading">
                        <h3 id="coupon-history-heading" className="profile-card-title">
                            <BadgePercent size={18} strokeWidth={2} aria-hidden="true" />
                            Coupon history
                        </h3>
                        <div className="profile-loyalty-summary">
                            <div>
                                <span>Available rewards</span>
                                <strong>{activeCoupons.length}</strong>
                            </div>
                            <div>
                                <span>Next reward</span>
                                <strong>
                                    {nextReward
                                        ? `${formatMMK(nextReward.threshold_mmk)} / ${nextReward.discount_percent}%`
                                        : 'Top tier reached'}
                                </strong>
                            </div>
                        </div>
                        <p className="profile-loyalty-help">
                            Paid orders add to your credit score. When a tier is reached, the coupon is created once and stays here until you use it in the cart.
                        </p>
                        {couponHistory.length === 0 ? (
                            <p className="profile-orders-empty">
                                No coupons yet. Your first reward unlocks at {formatMMK(thresholdMmk)}.
                            </p>
                        ) : (
                            <ul className="profile-coupon-list">
                                {couponHistory.map((coupon) => (
                                    <li key={coupon.id || coupon.code} className="profile-coupon">
                                        <div className="profile-coupon-main">
                                            <span className="profile-coupon-code">{coupon.code}</span>
                                            <span className="profile-coupon-detail">
                                                {coupon.discount_percent}% off after {formatMMK(coupon.threshold_mmk)}
                                            </span>
                                        </div>
                                        <div className="profile-coupon-meta">
                                            <span className={`profile-coupon-status profile-coupon-status--${coupon.status}`}>
                                                {couponStatusLabel(coupon.status)}
                                            </span>
                                            {coupon.used_order_id ? (
                                                <span className="profile-coupon-order">Order #{coupon.used_order_id}</span>
                                            ) : null}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="profile-card" aria-labelledby="orders-heading">
                        <h3 id="orders-heading" className="profile-card-title">
                            <Package size={18} strokeWidth={2} aria-hidden="true" />
                            Order history
                        </h3>
                        {orders.length === 0 ? (
                            <p className="profile-orders-empty">
                                No orders yet. When you check out, your purchases will appear here.
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
                                                {Number(order.credit_earned_mmk || 0) > 0 ? (
                                                    <span className="profile-order-credit">
                                                        +{formatMMK(order.credit_earned_mmk)} credit
                                                    </span>
                                                ) : null}
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
                        </>
                    )}
                </div>

                <aside className="profile-aside" aria-label="Quick actions">
                    <div className="profile-card profile-card--sticky">
                        <h3 className="profile-card-title profile-card-title--plain">Quick links</h3>
                        <nav className="profile-quick-nav" aria-label={isAdmin ? 'Admin shortcuts' : 'Shopping shortcuts'}>
                            {isAdmin ? (
                                ADMIN_QUICK_LINKS
                                    .filter(([, , , permission]) => !permission || can(permission))
                                    .map(([label, to, Icon]) => (
                                        <Link key={to} className="profile-quick-link" to={to}>
                                            <Icon size={18} aria-hidden="true" />
                                            <span>{label}</span>
                                            <ChevronRight size={18} className="profile-quick-chevron" aria-hidden="true" />
                                        </Link>
                                    ))
                            ) : (
                                <>
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
                                </>
                            )}
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
