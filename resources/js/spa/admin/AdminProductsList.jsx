import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutPanelTop, Warehouse } from 'lucide-react';
import { formatMMK } from '../utils/money.js';
import { AdminAccessState, AdminEmptyState, AdminErrorNotice } from './AdminRecovery.jsx';

const PRODUCT_SORTS = new Set(['newest', 'oldest', 'name_asc', 'name_desc', 'price_asc', 'price_desc']);
const PRODUCT_STATUS = new Set(['all', 'active', 'inactive']);

function normalizePage(raw) {
    const value = parseInt(String(raw || '1'), 10);
    if (Number.isNaN(value) || value < 1) return 1;
    return value;
}

function minPrice(product) {
    const values = (product?.variants || [])
        .map((v) => Number(v.price_mmk))
        .filter((n) => !Number.isNaN(n));
    if (values.length === 0) return null;
    return Math.min(...values);
}

export default function AdminProductsList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQ = (searchParams.get('q') || '').trim();
    const initialStatus = PRODUCT_STATUS.has(searchParams.get('status') || '') ? searchParams.get('status') : 'active';
    const initialSort = PRODUCT_SORTS.has(searchParams.get('sort') || '') ? searchParams.get('sort') : 'newest';
    const initialPage = normalizePage(searchParams.get('page'));

    const [gate, setGate] = useState('loading');
    const [currentUser, setCurrentUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchInput, setSearchInput] = useState(initialQ);
    const [filters, setFilters] = useState({
        q: initialQ,
        status: initialStatus,
        sort: initialSort,
    });
    const [page, setPage] = useState(initialPage);
    const [meta, setMeta] = useState({
        current_page: 1,
        last_page: 1,
        per_page: 9,
        total: 0,
    });

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                const user = res.data?.user;
                if (cancelled) return;
                setCurrentUser(user || null);
                if (!user) return setGate('unauthenticated');
                if (!user.permissions?.manage_catalog) return setGate('forbidden');
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
        if (gate !== 'admin') {
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError('');

        axios.get('/api/admin/products', {
            params: {
                q: filters.q,
                status: filters.status,
                sort: filters.sort,
                page,
                per_page: 9,
            },
        })
            .then((res) => {
                if (cancelled) return;
                setProducts(res.data?.products || []);
                setMeta(res.data?.meta || {
                    current_page: 1,
                    last_page: 1,
                    per_page: 9,
                    total: 0,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setProducts([]);
                setMeta({
                    current_page: 1,
                    last_page: 1,
                    per_page: 9,
                    total: 0,
                });
                setError('Failed to load products.');
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
        if (filters.status !== 'active') next.set('status', filters.status);
        if (filters.sort !== 'newest') next.set('sort', filters.sort);
        if (page > 1) next.set('page', String(page));
        setSearchParams(next, { replace: true });
    }, [filters, page, setSearchParams]);

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
            status: 'active',
            sort: 'newest',
        });
    };
    const retryProducts = () => setFilters((f) => ({ ...f }));
    const hasActiveFilters = filters.q !== '' || filters.status !== 'active' || filters.sort !== 'newest';
    const can = (permission) => Boolean(currentUser?.permissions?.[permission] ?? currentUser?.is_admin);


    if (gate === 'loading') return <div className="page-container admin-products-page">Loading...</div>;
    if (gate === 'unauthenticated') {
        return <AdminAccessState type="unauthenticated">Sign in with an admin account to manage products, variants, inventory, and boards.</AdminAccessState>;
    }
    if (gate === 'forbidden') {
        return (
            <AdminAccessState>
                Your current role cannot manage products. Ask a Super Admin for Inventory Admin, Manager, or Super Admin access if you need catalog controls.
            </AdminAccessState>
        );
    }

    return (
        <div className="page-container admin-products-page">
            <div className="admin-products-header">
                <h1>Products</h1>
                <div className="admin-products-header-actions">
                    <Link to="/admin/products/create" className="admin-products-btn">Create Product</Link>
                </div>
            </div>

            <section className="admin-related-tools" aria-label="Product related admin tools">
                <div>
                    <strong>Related product tools</strong>
                    <span>Track stock movements and manage storefront boards from product operations.</span>
                </div>
                <div className="admin-related-tools-actions">
                    {can('manage_inventory') ? (
                        <Link to="/admin/inventory" className="admin-products-btn admin-products-btn--ghost">
                            <Warehouse size={15} aria-hidden="true" />
                            Inventory History
                        </Link>
                    ) : null}
                    {can('manage_marketing') ? (
                        <Link to="/admin/boards" className="admin-products-btn admin-products-btn--ghost">
                            <LayoutPanelTop size={15} aria-hidden="true" />
                            Boards
                        </Link>
                    ) : null}
                </div>
            </section>

            <section className="admin-products-panel">
                <h2>Products ({meta.total})</h2>
                <p className="admin-products-subtext">
                    Showing <strong>{filters.status === 'all' ? 'all' : filters.status}</strong> products.
                </p>
                <form className="admin-products-toolbar" onSubmit={submitSearch}>
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search products..."
                    />
                    <select
                        value={filters.status}
                        onChange={(e) => {
                            setPage(1);
                            setFilters((f) => ({ ...f, status: e.target.value }));
                        }}
                    >
                        <option value="active">Active only</option>
                        <option value="inactive">Inactive only</option>
                        <option value="all">All products</option>
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
                        <option value="name_asc">Name A-Z</option>
                        <option value="name_desc">Name Z-A</option>
                        <option value="price_asc">Price low-high</option>
                        <option value="price_desc">Price high-low</option>
                    </select>
                    <button type="submit" className="admin-products-btn">Search</button>
                    <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                        Reset
                    </button>
                </form>
                {loading ? <p className="admin-products-state">Loading products...</p> : null}
                {error ? (
                    <AdminErrorNotice onRetry={retryProducts}>{error}</AdminErrorNotice>
                ) : null}

                <div className="admin-products-list">
                    {products.map((p) => (
                        <article key={p.id} className="admin-products-card">
                            <div className="admin-products-thumb-wrap">
                                {p.image_url ? (
                                    <img src={p.image_url} alt={p.name} className="admin-products-thumb" />
                                ) : (
                                    <div className="admin-products-thumb admin-products-thumb--placeholder">No image</div>
                                )}
                            </div>
                            <div className="admin-products-card-body">
                                <p className="admin-products-id">Product #{p.id}</p>
                                <h3>{p.name}</h3>
                                <p className="admin-products-meta">{p.category || 'General'} - {p.brand || 'No brand'}</p>
                                <p className="admin-products-desc">{p.description || 'No description'}</p>
                                <p className="admin-products-price">{minPrice(p) !== null ? `From ${formatMMK(minPrice(p))}` : 'No variant price'}</p>
                                <div className="admin-products-chip-row">
                                    <span className={`admin-products-chip ${p.is_active ? 'admin-products-chip--active' : 'admin-products-chip--inactive'}`}>
                                        {p.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    <span className="admin-products-chip">Variants: {(p.variants || []).length}</span>
                                </div>
                            </div>
                            <div className="admin-products-card-actions">
                                <Link
                                    to={`/admin/products/${p.id}/edit`}
                                    className="admin-products-btn admin-products-btn--compact"
                                >
                                    Edit Product
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
                {!loading && products.length === 0 ? (
                    <AdminEmptyState
                        title="No products found"
                        actions={hasActiveFilters ? (
                            <button type="button" className="admin-products-btn admin-products-btn--ghost" onClick={resetFilters}>
                                Reset Filters
                            </button>
                        ) : (
                            <Link to="/admin/products/create" className="admin-products-btn">Create Product</Link>
                        )}
                    >
                        {hasActiveFilters ? 'Your current filters are hiding all products. Reset them or broaden the search.' : 'Your catalog is empty. Create the first product to start selling.'}
                    </AdminEmptyState>
                ) : null}
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
        </div>
    );
}
