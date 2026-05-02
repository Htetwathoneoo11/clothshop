import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, Boxes, CreditCard, RefreshCw, ShieldAlert, ShoppingBag } from 'lucide-react';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminEmptyState, AdminErrorNotice } from './AdminRecovery.jsx';

function formatDateTime(iso) {
    if (!iso) return '-';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch {
        return '-';
    }
}

function notificationIcon(type) {
    if (type === 'out_of_stock' || type === 'low_stock') return Boxes;
    if (type === 'failed_payment') return CreditCard;
    if (type === 'high_value_order') return ShoppingBag;
    if (type === 'security_review' || type === 'admin_activity_spike') return ShieldAlert;
    return AlertTriangle;
}

export default function AdminNotifications() {
    const navigate = useNavigate();
    const [gate, setGate] = useState('loading');
    const [notifications, setNotifications] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [counts, setCounts] = useState({ total: 0, critical: 0, warning: 0, info: 0 });
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [reviewingId, setReviewingId] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const user = res.data?.user;
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.view_notifications) return setGate('forbidden');
                setGate('admin');
            })
            .catch(() => {
                if (!cancelled) setGate('unauthenticated');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (gate !== 'admin') return;
        let cancelled = false;
        setLoading(true);
        setError('');
        axios.get('/api/admin/notifications')
            .then((res) => {
                if (cancelled) return;
                setNotifications(res.data?.notifications || []);
                setCounts(res.data?.counts || { total: 0, critical: 0, warning: 0, info: 0 });
                setSelectedIds([]);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load admin notifications.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gate, refreshKey]);

    useEffect(() => {
        if (gate !== 'admin') return;
        let cancelled = false;
        setHistoryLoading(true);
        axios.get('/api/admin/notifications/reviews')
            .then((res) => {
                if (!cancelled) setReviews(res.data?.reviews || []);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load notification review history.');
            })
            .finally(() => {
                if (!cancelled) setHistoryLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gate, refreshKey]);

    const loadReviewHistory = async () => {
        const res = await axios.get('/api/admin/notifications/reviews');
        setReviews(res.data?.reviews || []);
    };

    const requestReview = (notification) => {
        setConfirmAction({
            type: 'single',
            notification,
            title: 'Mark alert as reviewed?',
            body: `${notification.title} will disappear from active notifications. You can still reopen its context from Review history.`,
            confirmLabel: 'Mark Reviewed',
        });
    };

    const requestBulkReview = () => {
        if (selectedIds.length === 0) return;
        setConfirmAction({
            type: 'bulk',
            title: 'Mark selected alerts as reviewed?',
            body: `${selectedIds.length} selected alerts will disappear from active notifications.`,
            confirmLabel: 'Mark Reviewed',
        });
    };

    const markReviewed = async (notification) => {
        setReviewingId(notification.id);
        setError('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post(`/api/admin/notifications/${encodeURIComponent(notification.id)}/review`);
            setNotifications(res.data?.notifications || []);
            setCounts(res.data?.counts || { total: 0, critical: 0, warning: 0, info: 0 });
            setSelectedIds([]);
            await loadReviewHistory();
            window.dispatchEvent(new CustomEvent('admin-notifications-reviewed'));
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to mark notification as reviewed.');
        } finally {
            setReviewingId('');
        }
    };

    const bulkReview = async () => {
        setReviewingId('bulk');
        setError('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.post('/api/admin/notifications/bulk-review', {
                notification_ids: selectedIds,
            });
            setNotifications(res.data?.notifications || []);
            setCounts(res.data?.counts || { total: 0, critical: 0, warning: 0, info: 0 });
            setSelectedIds([]);
            await loadReviewHistory();
            window.dispatchEvent(new CustomEvent('admin-notifications-reviewed'));
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to review selected notifications.');
        } finally {
            setReviewingId('');
        }
    };

    const runConfirmedAction = async () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'bulk') {
            await bulkReview();
        } else {
            await markReviewed(confirmAction.notification);
        }
        setConfirmAction(null);
    };

    const toggleSelected = (notificationId) => {
        setSelectedIds((ids) => ids.includes(notificationId)
            ? ids.filter((id) => id !== notificationId)
            : [...ids, notificationId]);
    };

    const allSelected = notifications.length > 0 && selectedIds.length === notifications.length;

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to review stock, order, payment, and security alerts.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState>
                Your current role cannot view admin notifications. Ask a Super Admin for notification access if you need operational alerts.
            </AdminAccessState>
        );
    }

    return (
        <div className="page-container admin-notifications-page">
            <div className="admin-products-header">
                <div>
                    <h1>Admin Notifications</h1>
                    <p className="admin-products-subtext">Live operational alerts for stock, payment, order, and security signals.</p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin" className="admin-products-btn admin-products-btn--ghost">Dashboard</Link>
                    <button type="button" className="admin-products-btn" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        Refresh
                    </button>
                </div>
            </div>

            {error ? (
                <AdminErrorNotice onRetry={() => setRefreshKey((key) => key + 1)}>
                    {error}
                </AdminErrorNotice>
            ) : null}
            {loading ? <p className="admin-products-state">Loading notifications...</p> : null}

            <AdminTip id="notifications">
                Use Open to inspect the linked record without removing the alert. Use Mark reviewed only after you have handled it.
            </AdminTip>

            <section className="admin-notifications-summary" aria-label="Notification counts">
                <article>
                    <Bell size={18} aria-hidden="true" />
                    <span>Total</span>
                    <strong>{counts.total}</strong>
                </article>
                <article className="admin-notifications-summary--critical">
                    <ShieldAlert size={18} aria-hidden="true" />
                    <span>Critical</span>
                    <strong>{counts.critical}</strong>
                </article>
                <article className="admin-notifications-summary--warning">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>Warnings</span>
                    <strong>{counts.warning}</strong>
                </article>
            </section>

            <section className="admin-products-panel">
                {notifications.length === 0 ? (
                    <AdminEmptyState
                        title="No alerts right now"
                        actions={(
                            <>
                                <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={() => setRefreshKey((key) => key + 1)}>
                                    Check Again
                                </button>
                                <Link to="/admin" className="admin-products-btn admin-products-btn--ghost">Dashboard</Link>
                            </>
                        )}
                    >
                        Stock, payment, order, and security signals all look quiet. You can check again or return to the dashboard.
                    </AdminEmptyState>
                ) : (
                    <>
                    <div className="admin-notification-bulkbar">
                        <label>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(event) => setSelectedIds(event.target.checked ? notifications.map((item) => item.id) : [])}
                            />
                            Select all
                        </label>
                        <button type="button" className="admin-products-btn" onClick={requestBulkReview} disabled={selectedIds.length === 0 || reviewingId === 'bulk'}>
                            {reviewingId === 'bulk' ? 'Saving...' : `Mark Reviewed (${selectedIds.length})`}
                        </button>
                    </div>
                    <ul className="admin-notifications-list">
                        {notifications.map((notification) => {
                            const Icon = notificationIcon(notification.type);
                            return (
                                <li key={notification.id} className={`admin-notification admin-notification--${notification.priority}`}>
                                    <label className="admin-notification-check">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(notification.id)}
                                            onChange={() => toggleSelected(notification.id)}
                                            aria-label={`Select ${notification.title}`}
                                        />
                                    </label>
                                    <span className="admin-notification-icon" aria-hidden="true">
                                        <Icon size={19} />
                                    </span>
                                    <div>
                                        <strong>{notification.title}</strong>
                                        <p>{notification.message}</p>
                                        <small>{formatDateTime(notification.created_at)}</small>
                                    </div>
                                    <div className="admin-notification-actions">
                                        {notification.action_url ? (
                                            <button
                                                type="button"
                                                className="admin-dashboard-text-link admin-notification-action"
                                                onClick={() => navigate(notification.action_url)}
                                                disabled={reviewingId === notification.id}
                                            >
                                                Open
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="admin-dashboard-text-link admin-notification-action"
                                            onClick={() => requestReview(notification)}
                                            disabled={reviewingId === notification.id}
                                        >
                                            {reviewingId === notification.id ? 'Saving...' : 'Mark reviewed'}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    </>
                )}
            </section>

            <section className="admin-products-panel">
                <div className="admin-dashboard-panel-head">
                    <h2>Review history</h2>
                    <button type="button" className="admin-dashboard-text-link admin-notification-action" onClick={() => setRefreshKey((key) => key + 1)}>
                        Refresh
                    </button>
                </div>
                {historyLoading ? (
                    <p className="admin-products-state">Loading review history...</p>
                ) : reviews.length === 0 ? (
                    <p className="admin-products-state">No reviewed alerts yet.</p>
                ) : (
                    <ul className="admin-notification-history">
                        {reviews.map((review) => (
                            <li key={review.id}>
                                <div>
                                    <strong>{review.title}</strong>
                                    <span>{review.type} - {review.priority}</span>
                                    {review.action_url ? (
                                        <button
                                            type="button"
                                            className="admin-dashboard-text-link admin-notification-action"
                                            onClick={() => navigate(review.action_url)}
                                        >
                                            Open context
                                        </button>
                                    ) : null}
                                </div>
                                <div>
                                    <strong>{review.reviewer?.username || 'Unknown'}</strong>
                                    <span>{formatDateTime(review.reviewed_at)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {confirmAction ? (
                <ConfirmDialog
                    title={confirmAction.title}
                    body={confirmAction.body}
                    confirmLabel={confirmAction.confirmLabel}
                    busy={Boolean(reviewingId)}
                    onCancel={() => setConfirmAction(null)}
                    onConfirm={runConfirmedAction}
                />
            ) : null}
        </div>
    );
}

function ConfirmDialog({ title, body, confirmLabel, busy, onCancel, onConfirm }) {
    return (
        <div className="admin-confirm-backdrop" role="presentation">
            <div className="admin-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-notification-confirm-title">
                <h2 id="admin-notification-confirm-title">{title}</h2>
                <p>{body}</p>
                <div className="admin-confirm-actions">
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className="admin-products-btn admin-products-btn--danger" onClick={onConfirm} disabled={busy}>
                        {busy ? 'Working...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
