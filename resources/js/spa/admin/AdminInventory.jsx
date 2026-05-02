import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Boxes,
    ChevronRight,
    Loader2,
    PackageMinus,
    PackagePlus,
    RefreshCw,
    Search,
    Warehouse,
    X,
} from 'lucide-react';
import AdminTip from './AdminTip.jsx';
import { AdminAccessState, AdminEmptyState, AdminErrorNotice } from './AdminRecovery.jsx';

const DIRECTIONS = new Set(['all', 'increase', 'decrease']);
const SORTS = new Set(['newest', 'oldest', 'largest_change']);

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

function reasonLabel(reason) {
    return String(reason || 'manual').replace(/_/g, ' ');
}

function variantLabel(variant) {
    if (!variant) return 'Unknown variant';
    const product = variant.product?.name || 'Unknown product';
    const options = [variant.color, variant.size].filter(Boolean).join(' / ');
    return `${product}${options ? ` - ${options}` : ''}`;
}

function variantOptionLabel(variant) {
    const product = variant?.product?.name || 'Unknown product';
    const options = [variant?.color, variant?.size].filter(Boolean).join(' / ');
    return `${product}${options ? ` - ${options}` : ''}`;
}

export default function AdminInventory() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const routeParams = useParams();
    const routeSelectedId = /^\d+$/.test(routeParams.id || '') ? routeParams.id : '';
    const initialQ = (searchParams.get('q') || '').trim();
    const initialReason = searchParams.get('reason') || 'all';
    const initialDirection = DIRECTIONS.has(searchParams.get('direction') || '') ? searchParams.get('direction') : 'all';
    const initialVariantId = searchParams.get('variant_id') || 'all';
    const initialSort = SORTS.has(searchParams.get('sort') || '') ? searchParams.get('sort') : 'newest';
    const initialPage = normalizePage(searchParams.get('page'));
    const querySelectedId = /^\d+$/.test(searchParams.get('selected') || '') ? searchParams.get('selected') : '';
    const initialSelected = routeSelectedId || querySelectedId;

    const [gate, setGate] = useState('loading');
    const [adjustments, setAdjustments] = useState([]);
    const [selectedAdjustment, setSelectedAdjustment] = useState(null);
    const [selectedId, setSelectedId] = useState(initialSelected);
    const [reasons, setReasons] = useState(['restock', 'correction', 'damage', 'return', 'manual']);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [variantSearch, setVariantSearch] = useState('');
    const [variantOptions, setVariantOptions] = useState([]);
    const [variantLoading, setVariantLoading] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [searchInput, setSearchInput] = useState(initialQ);
    const [filters, setFilters] = useState({
        q: initialQ,
        reason: initialReason,
        direction: initialDirection,
        variant_id: initialVariantId,
        sort: initialSort,
    });
    const [page, setPage] = useState(initialPage);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 0,
    });
    const [form, setForm] = useState({
        product_variant_id: '',
        adjustment: '',
        reason: 'restock',
        note: '',
    });

    useEffect(() => {
        if (gate !== 'admin') return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            setVariantLoading(true);
            axios.get('/api/admin/inventory-variants', {
                params: { q: variantSearch.trim() },
            })
                .then((res) => {
                    if (!cancelled) setVariantOptions(res.data?.variants || []);
                })
                .catch(() => {
                    if (!cancelled) setVariantOptions([]);
                })
                .finally(() => {
                    if (!cancelled) setVariantLoading(false);
                });
        }, variantSearch.trim() ? 250 : 0);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [gate, variantSearch]);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (cancelled) return;
                const user = res.data?.user;
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.manage_inventory) return setGate('forbidden');
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
        axios.get('/api/admin/inventory-adjustments', {
            params: {
                q: filters.q,
                reason: filters.reason,
                direction: filters.direction,
                variant_id: filters.variant_id,
                sort: filters.sort,
                page,
                per_page: 10,
            },
        })
            .then((res) => {
                if (cancelled) return;
                setAdjustments(res.data?.adjustments || []);
                setReasons(res.data?.reasons || reasons);
                setMeta(res.data?.meta || {
                    current_page: 1,
                    last_page: 1,
                    per_page: 10,
                    total: 0,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setAdjustments([]);
                setError('Failed to load inventory adjustments.');
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
        if (filters.reason !== 'all') next.set('reason', filters.reason);
        if (filters.direction !== 'all') next.set('direction', filters.direction);
        if (filters.variant_id !== 'all') next.set('variant_id', filters.variant_id);
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
            reason: 'all',
            direction: 'all',
            variant_id: 'all',
            sort: 'newest',
        });
    };

    const retryInventory = () => setFilters((f) => ({ ...f }));

    const openAdjustment = async (adjustmentId, options = {}) => {
        const nextId = String(adjustmentId);
        const { syncUrl = true } = options;
        setSelectedId(nextId);
        if (syncUrl && routeSelectedId !== nextId) {
            const next = new URLSearchParams();
            if (filters.q) next.set('q', filters.q);
            if (filters.reason !== 'all') next.set('reason', filters.reason);
            if (filters.direction !== 'all') next.set('direction', filters.direction);
            if (filters.variant_id !== 'all') next.set('variant_id', filters.variant_id);
            if (filters.sort !== 'newest') next.set('sort', filters.sort);
            if (page > 1) next.set('page', String(page));
            navigate({
                pathname: `/admin/inventory/${nextId}`,
                search: next.toString() ? `?${next.toString()}` : '',
            });
        }
        setDetailLoading(true);
        setError('');
        setNotice('');
        try {
            const res = await axios.get(`/api/admin/inventory-adjustments/${nextId}`);
            setSelectedAdjustment(res.data?.adjustment || null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load inventory adjustment.');
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (gate !== 'admin' || !selectedId || String(selectedAdjustment?.id || '') === selectedId) return;
        openAdjustment(selectedId, { syncUrl: !routeSelectedId });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gate, selectedId, selectedAdjustment?.id, routeSelectedId]);

    const createAdjustment = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await axios.get('/sanctum/csrf-cookie');
            const payload = {
                product_variant_id: parseInt(form.product_variant_id, 10),
                adjustment: parseInt(form.adjustment, 10),
                reason: form.reason,
                note: form.note.trim() || null,
            };
            const res = await axios.post('/api/admin/inventory-adjustments', payload);
            const created = res.data?.adjustment;
            setAdjustments((items) => [created, ...items]);
            setSelectedAdjustment(created);
            setSelectedId(String(created.id));
            setNotice(`Stock updated for ${variantLabel(created.variant)}.`);
            setForm({
                product_variant_id: '',
                adjustment: '',
                reason: 'restock',
                note: '',
            });
            setSelectedVariant(null);
            setVariantSearch('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save stock adjustment.');
        } finally {
            setSaving(false);
        }
    };

    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to review stock history and create inventory adjustments.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState backTo="/admin/products" backLabel="Back to Products">
                Your current role cannot manage inventory. Ask a Super Admin for Inventory Admin, Manager, or Super Admin access.
            </AdminAccessState>
        );
    }

    const hasActiveFilters = filters.q !== '' || filters.reason !== 'all' || filters.direction !== 'all' || filters.variant_id !== 'all' || filters.sort !== 'newest';

    return (
        <div className="page-container admin-inventory-page">
            <div className="admin-products-header">
                <div>
                    <h1>Inventory History</h1>
                    <p className="admin-products-subtext">{meta.total} stock movements found. Adjust stock with a traceable audit trail.</p>
                </div>
                <div className="admin-products-header-actions">
                    <Link to="/admin/products" className="admin-products-btn admin-products-btn--ghost">
                        <ArrowLeft size={15} aria-hidden="true" />
                        Back to Products
                    </Link>
                    <button type="button" className="admin-products-btn" onClick={retryInventory} disabled={loading}>
                        <RefreshCw size={15} aria-hidden="true" />
                        Refresh
                    </button>
                </div>
            </div>

            {notice ? <p className="admin-products-notice admin-products-notice--ok">{notice}</p> : null}
            {error ? (
                <AdminErrorNotice onRetry={selectedId ? () => openAdjustment(selectedId, { syncUrl: false }) : retryInventory}>
                    {error}
                </AdminErrorNotice>
            ) : null}

            <AdminTip id="inventory">
                Search and select the product variant before recording a stock movement. Low-stock notifications still filter by variant when no adjustment exists yet.
            </AdminTip>

            <section className="admin-products-panel">
                <form className="admin-inventory-adjust-form" onSubmit={createAdjustment}>
                    <div>
                        <h2>Stock adjustment</h2>
                        <p>Use a positive number to add stock, or a negative number for shrinkage/corrections.</p>
                    </div>
                    <div className="admin-variant-picker">
                        <label>
                            Product variant
                            <div className="admin-orders-search admin-variant-picker-search">
                                <Search size={16} aria-hidden="true" />
                                <input
                                    value={variantSearch}
                                    onChange={(e) => setVariantSearch(e.target.value)}
                                    placeholder="Search product, SKU, color, size..."
                                />
                            </div>
                        </label>
                        {selectedVariant ? (
                            <div className="admin-variant-selected">
                                <div>
                                    <strong>{variantOptionLabel(selectedVariant)}</strong>
                                    <span>Variant #{selectedVariant.id} - SKU {selectedVariant.sku || '-'} - stock {selectedVariant.stock}</span>
                                </div>
                                <button
                                    type="button"
                                    className="admin-help-card__dismiss"
                                    onClick={() => {
                                        setSelectedVariant(null);
                                        setForm((current) => ({ ...current, product_variant_id: '' }));
                                    }}
                                    aria-label="Clear selected variant"
                                >
                                    <X size={15} aria-hidden="true" />
                                </button>
                            </div>
                        ) : null}
                        <div className="admin-variant-picker-results">
                            {variantLoading ? <p className="admin-products-state">Searching variants...</p> : null}
                            {!variantLoading && variantOptions.length === 0 ? (
                                <p className="admin-products-state">No variants found. Try product name, SKU, color, or size.</p>
                            ) : null}
                            {!variantLoading && variantOptions.map((variant) => (
                                <button
                                    type="button"
                                    key={variant.id}
                                    className={`admin-variant-option ${Number(form.product_variant_id) === Number(variant.id) ? 'admin-variant-option--selected' : ''}`}
                                    onClick={() => {
                                        setSelectedVariant(variant);
                                        setForm((current) => ({ ...current, product_variant_id: String(variant.id) }));
                                    }}
                                >
                                    <span>
                                        <strong>{variantOptionLabel(variant)}</strong>
                                        <small>Variant #{variant.id} - SKU {variant.sku || '-'} - {variant.product?.brand || variant.product?.category || 'Product'}</small>
                                    </span>
                                    <b>{variant.stock} in stock</b>
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        value={form.adjustment}
                        onChange={(e) => setForm((current) => ({ ...current, adjustment: e.target.value }))}
                        placeholder="+10 or -3"
                        type="number"
                        min="-100000"
                        max="100000"
                        required
                    />
                    <select
                        value={form.reason}
                        onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))}
                        required
                    >
                        {reasons.map((reason) => (
                            <option key={reason} value={reason}>{reasonLabel(reason)}</option>
                        ))}
                    </select>
                    <input
                        value={form.note}
                        onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))}
                        placeholder="Optional note"
                        maxLength={500}
                    />
                    <button type="submit" className="admin-products-btn" disabled={saving || !form.product_variant_id}>
                        {saving ? 'Saving...' : 'Record'}
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
                            placeholder="Search SKU, product, actor, note..."
                        />
                    </div>
                    <select
                        value={filters.reason}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, reason: e.target.value }));
                        }}
                    >
                        <option value="all">All reasons</option>
                        {reasons.map((reason) => (
                            <option key={reason} value={reason}>{reasonLabel(reason)}</option>
                        ))}
                    </select>
                    <select
                        value={filters.direction}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, direction: e.target.value }));
                        }}
                    >
                        <option value="all">All movement</option>
                        <option value="increase">Increases</option>
                        <option value="decrease">Decreases</option>
                    </select>
                    <input
                        value={filters.variant_id === 'all' ? '' : filters.variant_id}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, variant_id: e.target.value.trim() || 'all' }));
                        }}
                        placeholder="Variant ID filter"
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
                        <option value="largest_change">Largest change</option>
                    </select>
                    <button type="submit" className="admin-products-btn">Search</button>
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                        Reset
                    </button>
                </form>
            </section>

            <div className="admin-orders-layout">
                <section className="admin-products-panel">
                    {loading ? <p className="admin-products-state">Loading inventory history...</p> : null}
                    {!loading && adjustments.length === 0 ? (
                        <AdminEmptyState
                            title="No stock movements found"
                            actions={hasActiveFilters ? (
                                <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                                    Reset Filters
                                </button>
                            ) : (
                                <Link to="/admin/products" className="admin-products-btn admin-products-btn--ghost">Find Product Variants</Link>
                            )}
                        >
                            {hasActiveFilters ? 'Your current filters are hiding all stock movements. Reset them or broaden the search.' : 'No inventory adjustments have been recorded yet. Search for a product variant above, then record the first movement.'}
                        </AdminEmptyState>
                    ) : (
                        <ul className="admin-inventory-list">
                            {adjustments.map((adjustment) => {
                                const isIncrease = adjustment.adjustment > 0;
                                const DeltaIcon = isIncrease ? PackagePlus : PackageMinus;
                                return (
                                    <li key={adjustment.id}>
                                        <button
                                            type="button"
                                            className={`admin-inventory-row ${selectedAdjustment?.id === adjustment.id ? 'admin-inventory-row--selected' : ''}`}
                                            onClick={() => openAdjustment(adjustment.id)}
                                        >
                                            <span className={`admin-inventory-icon ${isIncrease ? 'admin-inventory-icon--up' : 'admin-inventory-icon--down'}`} aria-hidden="true">
                                                <DeltaIcon size={18} />
                                            </span>
                                            <span className="admin-inventory-row-main">
                                                <strong>{variantLabel(adjustment.variant)}</strong>
                                                <span>SKU {adjustment.variant?.sku || '-'} - {formatDateTime(adjustment.created_at)}</span>
                                            </span>
                                            <span className="admin-inventory-row-side">
                                                <span className={`admin-inventory-delta ${isIncrease ? 'admin-inventory-delta--up' : 'admin-inventory-delta--down'}`}>
                                                    {isIncrease ? '+' : ''}{adjustment.adjustment}
                                                </span>
                                                <strong>{adjustment.previous_stock} {'->'} {adjustment.new_stock}</strong>
                                            </span>
                                            <ChevronRight size={17} aria-hidden="true" />
                                        </button>
                                    </li>
                                );
                            })}
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
                            <p>Loading movement...</p>
                        </div>
                    ) : selectedAdjustment ? (
                        <InventoryDetail adjustment={selectedAdjustment} />
                    ) : (
                        <div className="admin-orders-detail-empty">
                            <Warehouse size={28} aria-hidden="true" />
                            <p>Select a stock movement to inspect the before/after values and admin note.</p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

function InventoryDetail({ adjustment }) {
    const isIncrease = adjustment.adjustment > 0;
    const DeltaIcon = isIncrease ? PackagePlus : PackageMinus;

    return (
        <div className="admin-inventory-detail">
            <div className="admin-audit-detail-head">
                <span className={`admin-inventory-icon admin-audit-icon--lg ${isIncrease ? 'admin-inventory-icon--up' : 'admin-inventory-icon--down'}`} aria-hidden="true">
                    <DeltaIcon size={22} />
                </span>
                <div>
                    <p className="admin-products-id">Adjustment #{adjustment.id}</p>
                    <h2>{reasonLabel(adjustment.reason)}</h2>
                    <p>{variantLabel(adjustment.variant)}</p>
                </div>
            </div>

            <div className="admin-orders-detail-grid">
                <div>
                    <span>Previous</span>
                    <strong>{adjustment.previous_stock}</strong>
                </div>
                <div>
                    <span>Change</span>
                    <strong className={isIncrease ? 'admin-inventory-text-up' : 'admin-inventory-text-down'}>
                        {isIncrease ? '+' : ''}{adjustment.adjustment}
                    </strong>
                </div>
                <div>
                    <span>New stock</span>
                    <strong>{adjustment.new_stock}</strong>
                </div>
                <div>
                    <span>Variant</span>
                    <strong>#{adjustment.product_variant_id}</strong>
                </div>
            </div>

            <section className="admin-orders-detail-section">
                <h3><Boxes size={16} aria-hidden="true" /> Product</h3>
                <p>SKU {adjustment.variant?.sku || '-'}</p>
                <p>Color {adjustment.variant?.color || '-'}</p>
                <p>Size {adjustment.variant?.size || '-'}</p>
                <p>Current stock {adjustment.variant?.stock ?? '-'}</p>
            </section>

            <section className="admin-orders-detail-section">
                <h3>Audit context</h3>
                <p>Actor {adjustment.actor?.username || 'System'}</p>
                <p>Email {adjustment.actor?.email || '-'}</p>
                <p>Recorded {formatDateTime(adjustment.created_at)}</p>
                <p>Note {adjustment.note || '-'}</p>
            </section>
        </div>
    );
}
