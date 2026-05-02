import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BadgePercent, ChevronRight, Loader2, Package, RefreshCw, Search, Truck } from 'lucide-react';
import { formatMMK } from '../utils/money.js';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminEmptyState, AdminErrorNotice } from './AdminRecovery.jsx';

const ORDER_STATUS = new Set(['all', 'pending', 'paid', 'failed', 'cancelled']);
const ORDER_PAYMENT = new Set(['all', 'cash_on_delivery', 'card_on_delivery', 'stripe_checkout']);
const ORDER_SORTS = new Set(['newest', 'oldest', 'total_desc', 'total_asc', 'delivery_asc']);

function normalizePage(raw) {
    const value = parseInt(String(raw || '1'), 10);
    if (Number.isNaN(value) || value < 1) return 1;
    return value;
}

function formatDateTime(iso) {
    if (!iso) return '-';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch {
        return '-';
    }
}

function formatDelivery(order) {
    const delivery = order?.delivery || {};
    return [delivery.delivery_date, delivery.delivery_time].filter(Boolean).join(' at ') || '-';
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

function paymentLabel(payment) {
    switch (payment) {
        case 'cash_on_delivery':
            return 'Cash on delivery';
        case 'card_on_delivery':
            return 'Card on delivery';
        case 'stripe_checkout':
            return 'Stripe Checkout';
        default:
            return payment || '-';
    }
}

export default function AdminOrders() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const routeParams = useParams();
    const routeSelectedId = /^\d+$/.test(routeParams.id || '') ? routeParams.id : '';
    const initialQ = (searchParams.get('q') || '').trim();
    const initialStatus = ORDER_STATUS.has(searchParams.get('status') || '') ? searchParams.get('status') : 'all';
    const initialPayment = ORDER_PAYMENT.has(searchParams.get('payment') || '') ? searchParams.get('payment') : 'all';
    const initialSort = ORDER_SORTS.has(searchParams.get('sort') || '') ? searchParams.get('sort') : 'newest';
    const initialPage = normalizePage(searchParams.get('page'));
    const querySelectedId = /^\d+$/.test(searchParams.get('selected') || '') ? searchParams.get('selected') : '';
    const initialSelected = routeSelectedId || querySelectedId;

    const [gate, setGate] = useState('loading');
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedId, setSelectedId] = useState(initialSelected);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusBusy, setStatusBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [searchInput, setSearchInput] = useState(initialQ);
    const [filters, setFilters] = useState({
        q: initialQ,
        status: initialStatus,
        payment: initialPayment,
        sort: initialSort,
    });
    const [page, setPage] = useState(initialPage);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const user = res.data?.user;
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.manage_orders) return setGate('forbidden');
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
        axios.get('/api/admin/orders', {
            params: {
                q: filters.q,
                status: filters.status,
                payment: filters.payment,
                sort: filters.sort,
                page,
                per_page: 10,
            },
        })
            .then((res) => {
                if (cancelled) return;
                setOrders(res.data?.orders || []);
                setMeta(res.data?.meta || {
                    current_page: 1,
                    last_page: 1,
                    per_page: 10,
                    total: 0,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setOrders([]);
                setError('Failed to load orders.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gate, filters, page]);

    useEffect(() => {
        if (page > meta.last_page) {
            setPage(Math.max(1, meta.last_page));
        }
    }, [page, meta.last_page]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (filters.q) next.set('q', filters.q);
        if (filters.status !== 'all') next.set('status', filters.status);
        if (filters.payment !== 'all') next.set('payment', filters.payment);
        if (filters.sort !== 'newest') next.set('sort', filters.sort);
        if (selectedId && !routeSelectedId) next.set('selected', selectedId);
        if (page > 1) next.set('page', String(page));
        setSearchParams(next, { replace: true });
    }, [filters, page, selectedId, routeSelectedId, setSearchParams]);

    useEffect(() => {
        if (routeSelectedId && routeSelectedId !== selectedId) {
            setSelectedId(routeSelectedId);
        }
    }, [routeSelectedId, selectedId]);

    const submitSearch = (e) => {
        e.preventDefault();
        setPage(1);
        setFilters((f) => ({ ...f, q: searchInput.trim() }));
    };

    const resetFilters = () => {
        setSearchInput('');
        setPage(1);
        setFilters({
            q: '',
            status: 'all',
            payment: 'all',
            sort: 'newest',
        });
    };

    const retryOrders = () => setFilters((f) => ({ ...f }));

    const openOrder = async (orderId, options = {}) => {
        const nextId = String(orderId);
        const { syncUrl = true } = options;
        setSelectedId(nextId);
        if (syncUrl && routeSelectedId !== nextId) {
            const next = new URLSearchParams();
            if (filters.q) next.set('q', filters.q);
            if (filters.status !== 'all') next.set('status', filters.status);
            if (filters.payment !== 'all') next.set('payment', filters.payment);
            if (filters.sort !== 'newest') next.set('sort', filters.sort);
            if (page > 1) next.set('page', String(page));
            navigate({
                pathname: `/admin/orders/${nextId}`,
                search: next.toString() ? `?${next.toString()}` : '',
            });
        }
        setDetailLoading(true);
        setError('');
        setNotice('');
        try {
            const res = await axios.get(`/api/admin/orders/${nextId}`);
            setSelectedOrder(res.data?.order || null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load order details.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (gate !== 'admin' || !selectedId || String(selectedOrder?.id || '') === selectedId) return;
        openOrder(selectedId, { syncUrl: !routeSelectedId });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gate, selectedId, selectedOrder?.id, routeSelectedId]);

    const updateStatus = async (status) => {
        if (!selectedOrder || selectedOrder.status === status) return;
        setStatusBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.patch(`/api/admin/orders/${selectedOrder.id}/status`, { status });
            const updated = res.data?.order;
            setSelectedOrder(updated);
            setOrders((items) => items.map((item) => item.id === updated.id ? updated : item));
            setNotice(`Order #${updated.id} marked ${statusLabel(updated.status).toLowerCase()}.`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update order status.');
        } finally {
            setStatusBusy(false);
        }
    };

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to manage order fulfillment and payment status.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState>
                Your current role cannot manage orders. Ask a Super Admin for the Manager or Super Admin role if you need fulfillment access.
            </AdminAccessState>
        );
    }

    const hasActiveFilters = filters.q !== '' || filters.status !== 'all' || filters.payment !== 'all' || filters.sort !== 'newest';

    return (
        <div className="page-container admin-orders-page">
            <div className="admin-products-header">
                <div>
                    <h1>Orders</h1>
                    <p className="admin-products-subtext">{meta.total} orders found.</p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin" className="admin-products-btn admin-products-btn--ghost">Dashboard</Link>
                    <button type="button" className="admin-products-btn" onClick={retryOrders} disabled={loading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        Refresh
                    </button>
                </div>
            </div>

            {notice ? <p className="admin-products-notice admin-products-notice--ok">{notice}</p> : null}
            {error ? (
                <AdminErrorNotice onRetry={selectedId ? () => openOrder(selectedId, { syncUrl: false }) : retryOrders}>
                    {error}
                </AdminErrorNotice>
            ) : null}

            <AdminTip id="orders">
                Open any order to create a direct review link. Notifications now use those links, so reviewing payment or high-value order alerts lands on the exact order record.
            </AdminTip>

            <section className="admin-related-tools" aria-label="Order related admin tools">
                <div>
                    <strong>Related order tools</strong>
                    <span>Manage loyalty rewards and coupon usage connected to orders.</span>
                </div>
                <Link to="/admin/coupons" className="admin-products-btn admin-products-btn--ghost">
                    <BadgePercent size={15} aria-hidden="true" />
                    Coupons
                </Link>
            </section>

            <section className="admin-products-panel">
                <form className="admin-products-toolbar" onSubmit={submitSearch}>
                    <div className="admin-orders-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search orders, customers, phone..."
                        />
                    </div>
                    <select
                        value={filters.status}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, status: e.target.value }));
                        }}
                    >
                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                        value={filters.payment}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, payment: e.target.value }));
                        }}
                    >
                        <option value="all">All payments</option>
                        <option value="cash_on_delivery">Cash on delivery</option>
                        <option value="card_on_delivery">Card on delivery</option>
                        <option value="stripe_checkout">Stripe Checkout</option>
                    </select>
                    <select
                        value={filters.sort}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, sort: e.target.value }));
                        }}
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="total_desc">Total high-low</option>
                        <option value="total_asc">Total low-high</option>
                        <option value="delivery_asc">Delivery soonest</option>
                    </select>
                    <button type="submit" className="admin-products-btn">Search</button>
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                        Reset
                    </button>
                </form>
            </section>

            <div className="admin-orders-layout">
                <section className="admin-products-panel admin-orders-list-panel">
                    {loading ? <p className="admin-products-state">Loading orders...</p> : null}
                    {!loading && orders.length === 0 ? (
                        <AdminEmptyState
                            title="No orders found"
                            actions={hasActiveFilters ? (
                                <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                                    Reset Filters
                                </button>
                            ) : (
                                <Link to="/dashboard" className="admin-products-btn admin-products-btn--ghost">Preview Storefront</Link>
                            )}
                        >
                            {hasActiveFilters ? 'Your current filters are hiding all orders. Reset them or broaden the search.' : 'No customer orders have been placed yet. Preview the storefront if you want to test the purchase flow.'}
                        </AdminEmptyState>
                    ) : (
                        <ul className="admin-orders-list">
                            {orders.map((order) => (
                                <li key={order.id}>
                                    <button
                                        type="button"
                                        className={`admin-orders-row ${selectedOrder?.id === order.id ? 'admin-orders-row--selected' : ''}`}
                                        onClick={() => openOrder(order.id)}
                                    >
                                        <span className="admin-orders-row-icon" aria-hidden="true">
                                            <Package size={18} />
                                        </span>
                                        <span className="admin-orders-row-main">
                                            <strong>Order #{order.id}</strong>
                                            <span>{order.customer?.username || order.delivery?.name || 'Customer'} - {formatDateTime(order.created_at)}</span>
                                        </span>
                                        <span className="admin-orders-row-side">
                                            <span className={`admin-order-status admin-order-status--${order.status}`}>
                                                {statusLabel(order.status)}
                                            </span>
                                            <strong>{formatMMK(order.total_amount_mmk)}</strong>
                                        </span>
                                        <ChevronRight size={17} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="admin-products-pagination">
                        <button
                            type="button"
                            className="admin-products-btn"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                        >
                            Previous
                        </button>
                        <p>Page {meta.current_page} of {meta.last_page}</p>
                        <button
                            type="button"
                            className="admin-products-btn"
                            onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                            disabled={page >= meta.last_page || loading}
                        >
                            Next
                        </button>
                    </div>
                </section>

                <aside className="admin-products-panel admin-orders-detail-panel">
                    {detailLoading ? (
                        <div className="admin-orders-detail-empty">
                            <Loader2 className="checkout-spinner" size={24} aria-hidden="true" />
                            <p>Loading order...</p>
                        </div>
                    ) : selectedOrder ? (
                        <OrderDetail order={selectedOrder} statusBusy={statusBusy} onStatusChange={updateStatus} />
                    ) : (
                        <div className="admin-orders-detail-empty">
                            <Truck size={28} aria-hidden="true" />
                            <p>Select an order to review fulfillment and payment details.</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

function OrderDetail({ order, statusBusy, onStatusChange }) {
    const delivery = order.delivery || {};
    const payment = order.payment || {};

    return (
        <div className="admin-orders-detail">
            <div className="admin-orders-detail-head">
                <div>
                    <p className="admin-products-id">Order #{order.id}</p>
                    <h2>{order.customer?.username || delivery.name || 'Customer'}</h2>
                    <p>{order.customer?.email || delivery.phone_number || '-'}</p>
                </div>
                <span className={`admin-order-status admin-order-status--${order.status}`}>
                    {statusLabel(order.status)}
                </span>
            </div>

            <label className="admin-orders-status-field">
                <span>Status</span>
                <select value={order.status} onChange={(e) => onStatusChange(e.target.value)} disabled={statusBusy}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </label>

            <div className="admin-orders-detail-grid">
                <div>
                    <span>Total</span>
                    <strong>{formatMMK(order.total_amount_mmk)}</strong>
                </div>
                <div>
                    <span>Discount</span>
                    <strong>{formatMMK(order.discount_mmk || 0)}</strong>
                </div>
                <div>
                    <span>Payment</span>
                    <strong>{paymentLabel(payment.method)}</strong>
                </div>
                <div>
                    <span>Delivery</span>
                    <strong>{formatDelivery(order)}</strong>
                </div>
            </div>

            <section className="admin-orders-detail-section">
                <h3>Delivery</h3>
                <p>{delivery.name || '-'}</p>
                <p>{delivery.phone_number || '-'}</p>
                <p>{[delivery.building_or_flat, delivery.street_or_road, delivery.township, delivery.city].filter(Boolean).join(', ') || '-'}</p>
            </section>

            <section className="admin-orders-detail-section">
                <h3>Items</h3>
                <ul className="admin-orders-lines">
                    {(order.items || []).map((line, index) => (
                        <li key={`${order.id}-${index}`}>
                            <div>
                                <strong>{line.product_name}</strong>
                                <span>{[line.color, line.size].filter(Boolean).join(' / ') || '-'}</span>
                            </div>
                            <div>
                                <span>x{line.quantity}</span>
                                <strong>{formatMMK(line.line_total_mmk)}</strong>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {payment.coupon_code ? (
                <section className="admin-orders-detail-section">
                    <h3>Coupon</h3>
                    <p>{payment.coupon_code} - {payment.coupon_discount_percent}% off</p>
                </section>
            ) : null}
        </div>
    );
}
