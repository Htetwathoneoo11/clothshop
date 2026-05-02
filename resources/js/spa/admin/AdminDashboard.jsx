import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
    Activity,
    BadgeAlert,
    BadgePercent,
    BarChart3,
    Bell,
    Boxes,
    ClipboardList,
    Eye,
    LayoutPanelTop,
    PackageCheck,
    ReceiptText,
    Users,
    Warehouse,
} from 'lucide-react';
import { formatMMK } from '../utils/money.js';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminErrorNotice } from './AdminRecovery.jsx';

function formatDateTime(iso) {
    if (!iso) return '-';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch {
        return '-';
    }
}

function statusLabel(status) {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'paid':
            return 'Paid';
        case 'failed':
            return 'Failed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return status || 'Unknown';
    }
}

export default function AdminDashboard() {
    const [gate, setGate] = useState('loading');
    const [data, setData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const user = res.data?.user;
                setCurrentUser(user || null);
                if (!user) return setGate('unauthenticated');
                if (!user.is_admin) return setGate('forbidden');
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
        axios.get('/api/admin/dashboard')
            .then((res) => {
                if (!cancelled) setData(res.data);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load admin dashboard.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gate, refreshKey]);

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to view store operations, reports, and management shortcuts.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState backTo="/dashboard" backLabel="View as customer">
                This account is not assigned to an admin role. Use a staff account or ask a Super Admin to invite you.
            </AdminAccessState>
        );
    }

    const metrics = data?.metrics || {};
    const can = (permission) => Boolean(currentUser?.permissions?.[permission] ?? currentUser?.is_admin);
    const cards = [
        {
            label: 'Orders',
            value: metrics.orders?.total ?? 0,
            meta: `${metrics.orders?.pending ?? 0} pending`,
            icon: ClipboardList,
            tone: 'amber',
        },
        {
            label: 'Paid revenue',
            value: formatMMK(metrics.orders?.paid_revenue_mmk || 0),
            meta: `${metrics.orders?.paid ?? 0} paid orders`,
            icon: ReceiptText,
            tone: 'green',
        },
        {
            label: 'Products',
            value: metrics.products?.total ?? 0,
            meta: `${metrics.products?.active ?? 0} active`,
            icon: Boxes,
            tone: 'stone',
        },
        {
            label: 'Inventory alerts',
            value: (metrics.inventory?.low_stock_variants ?? 0) + (metrics.inventory?.out_of_stock_variants ?? 0),
            meta: `${metrics.inventory?.out_of_stock_variants ?? 0} out of stock`,
            icon: BadgeAlert,
            tone: 'red',
        },
        {
            label: 'Boards',
            value: metrics.boards?.total ?? 0,
            meta: `${metrics.boards?.active ?? 0} active`,
            icon: LayoutPanelTop,
            tone: 'blue',
        },
        {
            label: 'Customers',
            value: metrics.users?.customers ?? 0,
            meta: `${metrics.users?.admins ?? 0} admins`,
            icon: Users,
            tone: 'stone',
        },
    ];

    return (
        <div className="page-container admin-dashboard-page">
            <div className="admin-products-header">
                <div>
                    <h1>Admin Dashboard</h1>
                    <p className="admin-products-subtext">Store health, recent orders, and admin activity in one place.</p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin/orders" className="admin-products-btn">Manage Orders</Link>
                    <Link to="/dashboard" className="admin-products-btn admin-products-btn--ghost">
                        Preview Storefront
                    </Link>
                    <Link to="/admin/users" className="admin-products-btn admin-products-btn--ghost">Users</Link>
                    <Link to="/admin/products" className="admin-products-btn admin-products-btn--ghost">Products</Link>
                </div>
            </div>

            {error ? (
                <AdminErrorNotice onRetry={() => setRefreshKey((key) => key + 1)}>
                    {error}
                </AdminErrorNotice>
            ) : null}
            {loading ? <p className="admin-products-state">Loading dashboard...</p> : null}

            <AdminTip id="dashboard">
                Start from the dashboard when deciding what needs attention, then drill into orders, users, products, notifications, or reports for the exact record.
            </AdminTip>

            {can('view_reports') ? (
                <section className="admin-related-tools" aria-label="Dashboard related admin tools">
                    <div>
                        <strong>Dashboard insights</strong>
                        <span>Open deeper sales, customer, product, and inventory analytics.</span>
                    </div>
                    <Link to="/admin/reports" className="admin-products-btn admin-products-btn--ghost">
                        <BarChart3 size={15} aria-hidden="true" />
                        Analytics Reports
                    </Link>
                </section>
            ) : null}

            <section className="admin-dashboard-metrics" aria-label="Admin metrics">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article key={card.label} className={`admin-dashboard-metric admin-dashboard-metric--${card.tone}`}>
                            <span className="admin-dashboard-metric-icon" aria-hidden="true">
                                <Icon size={20} />
                            </span>
                            <span className="admin-dashboard-metric-label">{card.label}</span>
                            <strong>{card.value}</strong>
                            <span className="admin-dashboard-metric-meta">{card.meta}</span>
                        </article>
                    );
                })}
            </section>

            <div className="admin-dashboard-grid">
                <section className="admin-products-panel">
                    <div className="admin-dashboard-panel-head">
                        <h2>Recent orders</h2>
                        <Link to="/admin/orders" className="admin-dashboard-text-link">View all</Link>
                    </div>
                    {(data?.recent_orders || []).length === 0 ? (
                        <p className="admin-products-state">No orders yet.</p>
                    ) : (
                        <ul className="admin-dashboard-list">
                            {(data?.recent_orders || []).map((order) => (
                                <li key={order.id} className="admin-dashboard-list-row">
                                    <div>
                                        <strong>Order #{order.id}</strong>
                                        <span>{order.customer?.username || order.delivery?.name || 'Guest'} - {formatDateTime(order.created_at)}</span>
                                    </div>
                                    <div className="admin-dashboard-row-meta">
                                        <span className={`admin-order-status admin-order-status--${order.status}`}>
                                            {statusLabel(order.status)}
                                        </span>
                                        <strong>{formatMMK(order.total_amount_mmk)}</strong>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="admin-products-panel">
                    <div className="admin-dashboard-panel-head">
                        <h2>Recent activity</h2>
                        <Activity size={18} aria-hidden="true" />
                    </div>
                    {(data?.recent_activity || []).length === 0 ? (
                        <p className="admin-products-state">No admin activity recorded yet.</p>
                    ) : (
                        <ul className="admin-dashboard-list">
                            {(data?.recent_activity || []).map((activity) => (
                                <li key={activity.id} className="admin-dashboard-list-row">
                                    <div>
                                        <strong>{activity.action}</strong>
                                        <span>{activity.actor?.username || 'System'} - {formatDateTime(activity.created_at)}</span>
                                    </div>
                                    <span className="admin-dashboard-target">
                                        {activity.target_type} #{activity.target_id || '-'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="admin-dashboard-actions" aria-label="Admin shortcuts">
                {can('manage_orders') ? (
                    <Link to="/admin/orders">
                        <PackageCheck size={18} aria-hidden="true" />
                        Orders
                    </Link>
                ) : null}
                {can('manage_catalog') ? (
                    <Link to="/admin/products">
                        <Boxes size={18} aria-hidden="true" />
                        Products
                    </Link>
                ) : null}
                {can('manage_users') ? (
                    <Link to="/admin/users">
                        <Users size={18} aria-hidden="true" />
                        Users
                    </Link>
                ) : null}
                {can('view_audit') ? (
                    <Link to="/admin/audit-logs">
                        <Activity size={18} aria-hidden="true" />
                        Audit Logs
                    </Link>
                ) : null}
                {can('manage_loyalty') ? (
                    <Link to="/admin/coupons">
                        <BadgePercent size={18} aria-hidden="true" />
                        Coupons
                    </Link>
                ) : null}
                {can('manage_inventory') ? (
                    <Link to="/admin/inventory">
                        <Warehouse size={18} aria-hidden="true" />
                        Inventory
                    </Link>
                ) : null}
                {can('view_notifications') ? (
                    <Link to="/admin/notifications">
                        <Bell size={18} aria-hidden="true" />
                        Notifications
                    </Link>
                ) : null}
                {can('manage_marketing') ? (
                    <Link to="/admin/boards">
                        <LayoutPanelTop size={18} aria-hidden="true" />
                        Boards
                    </Link>
                ) : null}
                <Link to="/dashboard">
                    <Eye size={18} aria-hidden="true" />
                    Preview Storefront
                </Link>
            </section>
        </div>
    );
}
