import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BadgePercent, ChevronRight, Gift, Loader2, RefreshCw, Search, TicketPercent } from 'lucide-react';
import { formatMMK } from '../utils/money.js';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminEmptyState, AdminErrorNotice } from './AdminRecovery.jsx';

const COUPON_STATUS = new Set(['all', 'available', 'used', 'expired']);
const COUPON_SORTS = new Set(['newest', 'oldest', 'threshold_desc', 'discount_desc']);

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

function statusLabel(status) {
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

export default function AdminCoupons() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const routeParams = useParams();
    const routeSelectedId = /^\d+$/.test(routeParams.id || '') ? routeParams.id : '';
    const initialQ = (searchParams.get('q') || '').trim();
    const initialStatus = COUPON_STATUS.has(searchParams.get('status') || '') ? searchParams.get('status') : 'all';
    const initialUserId = searchParams.get('user_id') || 'all';
    const initialSort = COUPON_SORTS.has(searchParams.get('sort') || '') ? searchParams.get('sort') : 'newest';
    const initialPage = normalizePage(searchParams.get('page'));
    const querySelectedId = /^\d+$/.test(searchParams.get('selected') || '') ? searchParams.get('selected') : '';
    const initialSelected = routeSelectedId || querySelectedId;

    const [gate, setGate] = useState('loading');
    const [coupons, setCoupons] = useState([]);
    const [selectedCoupon, setSelectedCoupon] = useState(null);
    const [selectedId, setSelectedId] = useState(initialSelected);
    const [rewardTiers, setRewardTiers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);
    const [grantBusy, setGrantBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [searchInput, setSearchInput] = useState(initialQ);
    const [grantForm, setGrantForm] = useState({
        user_id: '',
        threshold_mmk: '',
        discount_percent: '',
        expires_at: '',
    });
    const [filters, setFilters] = useState({
        q: initialQ,
        status: initialStatus,
        user_id: initialUserId,
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
                if (!user.permissions?.manage_loyalty) return setGate('forbidden');
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
        axios.get('/api/admin/coupons', {
            params: {
                q: filters.q,
                status: filters.status,
                user_id: filters.user_id,
                sort: filters.sort,
                page,
                per_page: 10,
            },
        })
            .then((res) => {
                if (cancelled) return;
                setCoupons(res.data?.coupons || []);
                setRewardTiers(res.data?.reward_tiers || []);
                setMeta(res.data?.meta || {
                    current_page: 1,
                    last_page: 1,
                    per_page: 10,
                    total: 0,
                });
                setGrantForm((form) => ({
                    ...form,
                    threshold_mmk: form.threshold_mmk || String(res.data?.reward_tiers?.[0]?.threshold_mmk || ''),
                    discount_percent: form.discount_percent || String(res.data?.reward_tiers?.[0]?.discount_percent || ''),
                }));
            })
            .catch(() => {
                if (cancelled) return;
                setCoupons([]);
                setError('Failed to load coupons.');
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
        if (filters.user_id !== 'all') next.set('user_id', filters.user_id);
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
            user_id: 'all',
            sort: 'newest',
        });
    };

    const retryCoupons = () => setFilters((f) => ({ ...f }));

    const openCoupon = async (couponId, options = {}) => {
        const nextId = String(couponId);
        const { syncUrl = true } = options;
        setSelectedId(nextId);
        if (syncUrl && routeSelectedId !== nextId) {
            const next = new URLSearchParams();
            if (filters.q) next.set('q', filters.q);
            if (filters.status !== 'all') next.set('status', filters.status);
            if (filters.user_id !== 'all') next.set('user_id', filters.user_id);
            if (filters.sort !== 'newest') next.set('sort', filters.sort);
            if (page > 1) next.set('page', String(page));
            navigate({
                pathname: `/admin/coupons/${nextId}`,
                search: next.toString() ? `?${next.toString()}` : '',
            });
        }
        setDetailLoading(true);
        setError('');
        setNotice('');
        try {
            const res = await axios.get(`/api/admin/coupons/${nextId}`);
            setSelectedCoupon(res.data?.coupon || null);
            setRewardTiers(res.data?.reward_tiers || rewardTiers);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load coupon detail.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (gate !== 'admin' || !selectedId || String(selectedCoupon?.id || '') === selectedId) return;
        openCoupon(selectedId, { syncUrl: !routeSelectedId });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gate, selectedId, selectedCoupon?.id, routeSelectedId]);

    const mergeUpdatedCoupon = (updated) => {
        setSelectedCoupon(updated);
        setCoupons((items) => items.map((item) => item.id === updated.id ? updated : item));
    };

    const expireCoupon = async () => {
        if (!selectedCoupon) return;
        setActionBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.patch(`/api/admin/coupons/${selectedCoupon.id}/expire`);
            mergeUpdatedCoupon(res.data?.coupon);
            setNotice(`Coupon ${selectedCoupon.code} expired.`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to expire coupon.');
        } finally {
            setActionBusy(false);
        }
    };

    const reactivateCoupon = async () => {
        if (!selectedCoupon) return;
        setActionBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const res = await axios.patch(`/api/admin/coupons/${selectedCoupon.id}/reactivate`);
            mergeUpdatedCoupon(res.data?.coupon);
            setNotice(`Coupon ${selectedCoupon.code} reactivated.`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reactivate coupon.');
        } finally {
            setActionBusy(false);
        }
    };

    const grantCoupon = async (e) => {
        e.preventDefault();
        setGrantBusy(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const payload = {
                user_id: parseInt(grantForm.user_id, 10),
                threshold_mmk: parseInt(grantForm.threshold_mmk, 10),
                discount_percent: parseInt(grantForm.discount_percent, 10),
                expires_at: grantForm.expires_at || null,
            };
            const res = await axios.post('/api/admin/coupons', payload);
            const created = res.data?.coupon;
            setCoupons((items) => [created, ...items]);
            setSelectedCoupon(created);
            setSelectedId(String(created.id));
            setNotice(`Coupon ${created.code} granted.`);
            setGrantForm((form) => ({ ...form, user_id: '', expires_at: '' }));
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to grant coupon.');
        } finally {
            setGrantBusy(false);
        }
    };

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to manage loyalty coupons and rewards.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState backTo="/admin/orders" backLabel="Back to Orders">
                Your current role cannot manage loyalty coupons. Ask a Super Admin for Manager or Super Admin access if you need coupon controls.
            </AdminAccessState>
        );
    }

    const hasActiveFilters = filters.q !== '' || filters.status !== 'all' || filters.user_id !== 'all' || filters.sort !== 'newest';

    return (
        <div className="page-container admin-coupons-page">
            <div className="admin-products-header">
                <div>
                    <h1>Coupons</h1>
                    <p className="admin-products-subtext">{meta.total} loyalty coupons found.</p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin/orders" className="admin-products-btn admin-products-btn--ghost">
                        <ArrowLeft size={15} aria-hidden="true" />
                        Back to Orders
                    </Link>
                    <button type="button" className="admin-products-btn" onClick={retryCoupons} disabled={loading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        Refresh
                    </button>
                </div>
            </div>

            {notice ? <p className="admin-products-notice admin-products-notice--ok">{notice}</p> : null}
            {error ? (
                <AdminErrorNotice onRetry={selectedId ? () => openCoupon(selectedId, { syncUrl: false }) : retryCoupons}>
                    {error}
                </AdminErrorNotice>
            ) : null}

            <AdminTip id="coupons">
                Coupon rows now have direct URLs. Link to one coupon when checking ownership, expiry, or the order where a loyalty reward was used.
            </AdminTip>

            <section className="admin-coupon-tiers" aria-label="Reward tiers">
                {rewardTiers.map((tier) => (
                    <article key={tier.threshold_mmk} className="admin-coupon-tier">
                        <Gift size={18} aria-hidden="true" />
                        <span>{tier.label}</span>
                        <strong>{formatMMK(tier.threshold_mmk)}</strong>
                        <small>{tier.discount_percent}% off</small>
                    </article>
                ))}
            </section>

            <section className="admin-products-panel">
                <form className="admin-coupon-grant-form" onSubmit={grantCoupon}>
                    <h2>Grant coupon</h2>
                    <input
                        value={grantForm.user_id}
                        onChange={(e) => setGrantForm((form) => ({ ...form, user_id: e.target.value }))}
                        placeholder="User ID"
                        type="number"
                        min="1"
                        required
                    />
                    <select
                        value={grantForm.threshold_mmk}
                        onChange={(e) => {
                            const tier = rewardTiers.find((item) => String(item.threshold_mmk) === e.target.value);
                            setGrantForm((form) => ({
                                ...form,
                                threshold_mmk: e.target.value,
                                discount_percent: String(tier?.discount_percent || form.discount_percent),
                            }));
                        }}
                        required
                    >
                        {rewardTiers.map((tier) => (
                            <option key={tier.threshold_mmk} value={tier.threshold_mmk}>
                                {tier.label} - {formatMMK(tier.threshold_mmk)}
                            </option>
                        ))}
                    </select>
                    <input
                        value={grantForm.discount_percent}
                        onChange={(e) => setGrantForm((form) => ({ ...form, discount_percent: e.target.value }))}
                        placeholder="Discount %"
                        type="number"
                        min="1"
                        max="90"
                        required
                    />
                    <input
                        value={grantForm.expires_at}
                        onChange={(e) => setGrantForm((form) => ({ ...form, expires_at: e.target.value }))}
                        type="datetime-local"
                    />
                    <button type="submit" className="admin-products-btn" disabled={grantBusy}>
                        {grantBusy ? 'Granting...' : 'Grant'}
                    </button>
                </form>
            </section>

            <section className="admin-products-panel">
                <form className="admin-products-toolbar" onSubmit={submitSearch}>
                    <div className="admin-orders-search">
                        <Search size={16} aria-hidden="true" />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search code, user, order..."
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
                        <option value="available">Available</option>
                        <option value="used">Used</option>
                        <option value="expired">Expired</option>
                    </select>
                    <input
                        value={filters.user_id === 'all' ? '' : filters.user_id}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, user_id: e.target.value.trim() || 'all' }));
                        }}
                        placeholder="User ID filter"
                        type="number"
                        min="1"
                    />
                    <select
                        value={filters.sort}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, sort: e.target.value }));
                        }}
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="threshold_desc">Threshold high-low</option>
                        <option value="discount_desc">Discount high-low</option>
                    </select>
                    <button type="submit" className="admin-products-btn">Search</button>
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                        Reset
                    </button>
                </form>
            </section>

            <div className="admin-orders-layout">
                <section className="admin-products-panel">
                    {loading ? <p className="admin-products-state">Loading coupons...</p> : null}
                    {!loading && coupons.length === 0 ? (
                        <AdminEmptyState
                            title="No coupons found"
                            actions={hasActiveFilters ? (
                                <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                                    Reset Filters
                                </button>
                            ) : (
                                <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                                    Grant Coupon
                                </button>
                            )}
                        >
                            {hasActiveFilters ? 'Your current filters are hiding all coupons. Reset them or broaden the search.' : 'No loyalty coupons exist yet. Use the grant form above when you want to issue one manually.'}
                        </AdminEmptyState>
                    ) : (
                        <ul className="admin-coupon-list">
                            {coupons.map((coupon) => (
                                <li key={coupon.id}>
                                    <button
                                        type="button"
                                        className={`admin-coupon-row ${selectedCoupon?.id === coupon.id ? 'admin-coupon-row--selected' : ''}`}
                                        onClick={() => openCoupon(coupon.id)}
                                    >
                                        <span className="admin-coupon-icon" aria-hidden="true">
                                            <TicketPercent size={18} />
                                        </span>
                                        <span className="admin-coupon-row-main">
                                            <strong>{coupon.code}</strong>
                                            <span>{coupon.user?.username || 'Unknown user'} - {coupon.discount_percent}% off</span>
                                        </span>
                                        <span className="admin-coupon-row-side">
                                            <span className={`admin-user-chip admin-user-chip--${coupon.status}`}>
                                                {statusLabel(coupon.status)}
                                            </span>
                                            <strong>{formatMMK(coupon.threshold_mmk)}</strong>
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
                            <p>Loading coupon...</p>
                        </div>
                    ) : selectedCoupon ? (
                        <CouponDetail
                            coupon={selectedCoupon}
                            actionBusy={actionBusy}
                            onExpire={expireCoupon}
                            onReactivate={reactivateCoupon}
                        />
                    ) : (
                        <div className="admin-orders-detail-empty">
                            <BadgePercent size={28} aria-hidden="true" />
                            <p>Select a coupon to inspect ownership, usage, and status controls.</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

function CouponDetail({ coupon, actionBusy, onExpire, onReactivate }) {
    const canExpire = coupon.status === 'available';
    const canReactivate = coupon.status === 'expired';

    return (
        <div className="admin-coupon-detail">
            <div className="admin-audit-detail-head">
                <span className="admin-coupon-icon admin-audit-icon--lg" aria-hidden="true">
                    <TicketPercent size={22} />
                </span>
                <div>
                    <p className="admin-products-id">Coupon #{coupon.id}</p>
                    <h2>{coupon.code}</h2>
                    <p>{coupon.user?.username || 'Unknown user'} - {coupon.user?.email || '-'}</p>
                </div>
            </div>

            <div className="admin-orders-detail-grid">
                <div>
                    <span>Status</span>
                    <strong>{statusLabel(coupon.status)}</strong>
                </div>
                <div>
                    <span>Discount</span>
                    <strong>{coupon.discount_percent}%</strong>
                </div>
                <div>
                    <span>Threshold</span>
                    <strong>{formatMMK(coupon.threshold_mmk)}</strong>
                </div>
                <div>
                    <span>User credit</span>
                    <strong>{formatMMK(coupon.user?.credit_score || 0)}</strong>
                </div>
            </div>

            <div className="admin-coupon-actions">
                <button type="button" className="admin-products-btn admin-products-btn--danger" onClick={onExpire} disabled={!canExpire || actionBusy}>
                    Expire
                </button>
                <button type="button" className="admin-products-btn" onClick={onReactivate} disabled={!canReactivate || actionBusy}>
                    Reactivate
                </button>
            </div>

            <section className="admin-orders-detail-section">
                <h3>Usage</h3>
                <p>Used at {formatDateTime(coupon.used_at)}</p>
                <p>Used order {coupon.used_order_id ? `#${coupon.used_order_id}` : '-'}</p>
                <p>Expires {formatDateTime(coupon.expires_at)}</p>
                <p>Created {formatDateTime(coupon.created_at)}</p>
            </section>

            {coupon.used_order ? (
                <section className="admin-orders-detail-section">
                    <h3>Used order</h3>
                    <p>Order #{coupon.used_order.id}</p>
                    <p>Status {coupon.used_order.status}</p>
                    <p>Total {formatMMK(coupon.used_order.total_amount_mmk)}</p>
                </section>
            ) : null}
        </div>
    );
}
