import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    BarChart3,
    Boxes,
    ClipboardList,
    CreditCard,
    LineChart,
    RefreshCw,
    ShoppingBag,
    TrendingDown,
    TrendingUp,
    Users,
    WalletCards,
} from 'lucide-react';
import { formatMMK } from '../utils/money.js';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminErrorNotice } from './AdminRecovery.jsx';

const RANGE_OPTIONS = [
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
    { value: '365', label: '1 year' },
];
const VALID_RANGES = new Set(RANGE_OPTIONS.map((item) => item.value));

function formatDate(iso) {
    if (!iso) return '-';
    try {
        return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${iso}T00:00:00`));
    } catch {
        return iso;
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

function paymentLabel(method) {
    switch (method) {
        case 'cash_on_delivery':
            return 'Cash on delivery';
        case 'card_on_delivery':
            return 'Card on delivery';
        case 'stripe_checkout':
            return 'Stripe checkout';
        default:
            return method || 'Unknown';
    }
}

function changeLabel(value) {
    if (value === null || value === undefined) return 'New activity';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value}%`;
}

export default function AdminReports() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialDays = VALID_RANGES.has(searchParams.get('days') || '') ? searchParams.get('days') : '30';

    const [gate, setGate] = useState('loading');
    const [data, setData] = useState(null);
    const [days, setDays] = useState(initialDays);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const user = res.data?.user;
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.view_reports) return setGate('forbidden');
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
        axios.get('/api/admin/reports', { params: { days } })
            .then((res) => {
                if (!cancelled) setData(res.data);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load analytics report.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gate, days, refreshKey]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (days !== '30') next.set('days', days);
        setSearchParams(next, { replace: true });
    }, [days, setSearchParams]);

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to view analytics and reporting.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState>
                Your current role cannot view reports. Ask a Super Admin for Manager or Super Admin access if you need analytics.
            </AdminAccessState>
        );
    }

    const summary = data?.summary || {};
    const range = data?.range || {};
    const cards = [
        {
            label: 'Paid revenue',
            value: formatMMK(summary.paid_revenue_mmk || 0),
            meta: `${changeLabel(summary.paid_revenue_change_percent)} vs previous period`,
            icon: WalletCards,
            trend: summary.paid_revenue_change_percent,
        },
        {
            label: 'Paid orders',
            value: summary.orders_paid || 0,
            meta: `${summary.orders_total || 0} total orders`,
            icon: ClipboardList,
            trend: summary.paid_orders_change_percent,
        },
        {
            label: 'Average order',
            value: formatMMK(summary.average_order_value_mmk || 0),
            meta: `${formatMMK(summary.discounts_mmk || 0)} discounts`,
            icon: ShoppingBag,
            trend: 0,
        },
        {
            label: 'New customers',
            value: summary.new_customers || 0,
            meta: `${data?.customers?.active_customers || 0} active customers`,
            icon: Users,
            trend: 0,
        },
    ];

    return (
        <div className="page-container admin-reports-page">
            <div className="admin-products-header">
                <div>
                    <h1>Analytics & Reports</h1>
                    <p className="admin-products-subtext">
                        {range.from && range.to ? `${formatDate(range.from)} to ${formatDate(range.to)}` : 'Store performance, sales trends, and operational risk.'}
                    </p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin" className="admin-products-btn admin-products-btn--ghost">
                        <ArrowLeft size={15} aria-hidden="true" />
                        Back to Dashboard
                    </Link>
                    <select
                        className="admin-reports-range"
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                    >
                        {RANGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
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
            {loading ? <p className="admin-products-state">Loading analytics...</p> : null}

            <AdminTip id="reports">
                Use the range selector to compare short-term operations with longer-term store direction before changing coupons, stock, or promotion boards.
            </AdminTip>

            <section className="admin-reports-kpis" aria-label="Report summary">
                {cards.map((card) => (
                    <ReportCard key={card.label} card={card} />
                ))}
            </section>

            <section className="admin-products-panel admin-reports-chart-panel">
                <div className="admin-dashboard-panel-head">
                    <h2><LineChart size={18} aria-hidden="true" /> Sales trend</h2>
                    <span className="admin-dashboard-target">{range.days || days} days</span>
                </div>
                <SalesTrend points={data?.sales_trend || []} />
            </section>

            <div className="admin-reports-grid">
                <section className="admin-products-panel">
                    <div className="admin-dashboard-panel-head">
                        <h2><BarChart3 size={18} aria-hidden="true" /> Order status</h2>
                    </div>
                    <BreakdownList
                        items={(data?.orders_by_status || []).map((item) => ({
                            key: item.status,
                            label: statusLabel(item.status),
                            value: item.count,
                        }))}
                    />
                </section>

                <section className="admin-products-panel">
                    <div className="admin-dashboard-panel-head">
                        <h2><CreditCard size={18} aria-hidden="true" /> Payments</h2>
                    </div>
                    <BreakdownList
                        items={(data?.payment_methods || []).map((item) => ({
                            key: item.method,
                            label: paymentLabel(item.method),
                            value: item.orders,
                            meta: formatMMK(item.revenue_mmk || 0),
                        }))}
                    />
                </section>
            </div>

            <div className="admin-reports-grid">
                <section className="admin-products-panel">
                    <div className="admin-dashboard-panel-head">
                        <h2><ShoppingBag size={18} aria-hidden="true" /> Top products</h2>
                    </div>
                    <ReportTable
                        empty="No paid product sales in this range."
                        rows={(data?.top_products || []).map((item) => ({
                            id: item.id,
                            title: item.name,
                            meta: `${item.category || 'Product'} - ${item.units_sold} units`,
                            value: formatMMK(item.revenue_mmk || 0),
                        }))}
                    />
                </section>

                <section className="admin-products-panel">
                    <div className="admin-dashboard-panel-head">
                        <h2><Users size={18} aria-hidden="true" /> Customer value</h2>
                        <span className="admin-dashboard-target">{data?.customers?.repeat_customers || 0} repeat</span>
                    </div>
                    <ReportTable
                        empty="No paid customers in this range."
                        rows={(data?.customers?.top_customers || []).map((item) => ({
                            id: item.id || item.username,
                            title: item.username,
                            meta: `${item.orders_count} paid orders`,
                            value: formatMMK(item.spend_mmk || 0),
                        }))}
                    />
                </section>
            </div>

            <section className="admin-products-panel">
                <div className="admin-dashboard-panel-head">
                    <h2><Boxes size={18} aria-hidden="true" /> Inventory risk</h2>
                    <span className="admin-dashboard-target">{formatMMK(data?.inventory?.stock_value_mmk || 0)} stock value</span>
                </div>
                <div className="admin-reports-inventory">
                    <div>
                        <span>Total units</span>
                        <strong>{data?.inventory?.total_units || 0}</strong>
                    </div>
                    <div>
                        <span>Low stock</span>
                        <strong>{data?.inventory?.low_stock_variants || 0}</strong>
                    </div>
                    <div>
                        <span>Out of stock</span>
                        <strong>{data?.inventory?.out_of_stock_variants || 0}</strong>
                    </div>
                </div>
                <ReportTable
                    empty="No low-stock variants right now."
                    rows={(data?.inventory?.at_risk_variants || []).map((item) => ({
                        id: item.id,
                        title: item.product?.name || 'Unknown product',
                        meta: `SKU ${item.sku || '-'} - ${item.color || '-'} / ${item.size || '-'}`,
                        value: `${item.stock} left`,
                    }))}
                />
            </section>
        </div>
    );
}

function ReportCard({ card }) {
    const Icon = card.icon;
    const positive = card.trend === null || card.trend === undefined || card.trend >= 0;
    const TrendIcon = positive ? TrendingUp : TrendingDown;

    return (
        <article className={`admin-reports-kpi ${positive ? 'admin-reports-kpi--up' : 'admin-reports-kpi--down'}`}>
            <span className="admin-reports-kpi-icon" aria-hidden="true">
                <Icon size={20} />
            </span>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>
                <TrendIcon size={14} aria-hidden="true" />
                {card.meta}
            </small>
        </article>
    );
}

function SalesTrend({ points }) {
    const maxRevenue = Math.max(...points.map((point) => point.paid_revenue_mmk || 0), 1);

    if (points.length === 0) {
        return <p className="admin-products-state">No sales trend data yet.</p>;
    }

    return (
        <div className="admin-reports-bars" role="list" aria-label="Daily paid revenue">
            {points.map((point) => {
                const height = Math.max(8, Math.round(((point.paid_revenue_mmk || 0) / maxRevenue) * 100));
                return (
                    <div key={point.date} className="admin-reports-bar-item" role="listitem">
                        <div className="admin-reports-bar-track" title={`${formatDate(point.date)}: ${formatMMK(point.paid_revenue_mmk || 0)}`}>
                            <span style={{ height: `${height}%` }} />
                        </div>
                        <small>{formatDate(point.date)}</small>
                    </div>
                );
            })}
        </div>
    );
}

function BreakdownList({ items }) {
    const max = Math.max(...items.map((item) => item.value || 0), 1);

    if (items.length === 0) {
        return <p className="admin-products-state">No data in this range.</p>;
    }

    return (
        <ul className="admin-reports-breakdown">
            {items.map((item) => (
                <li key={item.key}>
                    <div>
                        <strong>{item.label}</strong>
                        <span>{item.meta || `${item.value} orders`}</span>
                    </div>
                    <b>{item.value}</b>
                    <span className="admin-reports-breakdown-bar" aria-hidden="true">
                        <i style={{ width: `${Math.round(((item.value || 0) / max) * 100)}%` }} />
                    </span>
                </li>
            ))}
        </ul>
    );
}

function ReportTable({ rows, empty }) {
    if (rows.length === 0) {
        return <p className="admin-products-state">{empty}</p>;
    }

    return (
        <ul className="admin-reports-table">
            {rows.map((row) => (
                <li key={row.id}>
                    <div>
                        <strong>{row.title}</strong>
                        <span>{row.meta}</span>
                    </div>
                    <b>{row.value}</b>
                </li>
            ))}
        </ul>
    );
}
