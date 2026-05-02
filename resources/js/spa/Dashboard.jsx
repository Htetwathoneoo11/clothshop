import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { formatMMK } from './utils/money.js';

axios.defaults.withCredentials = true;

const DASHBOARD_HERO_DEFAULT_SUBTITLE =
    'Browse tops, outerwear, and more. Filter by category, sort by price, or search the catalog.';

function heroCtaExternalAttrs(href) {
    try {
        const u = new URL(href, window.location.origin);
        if (u.origin !== window.location.origin) {
            return { target: '_blank', rel: 'noopener noreferrer' };
        }
    } catch {
        return { rel: 'noopener noreferrer' };
    }
    return {};
}

function isInternalAppHref(href) {
    return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');
}

function ProductCardSkeleton() {
    return (
        <div className="product-card-skeleton" aria-hidden>
            <div className="product-card-skeleton-media" />
            <div className="product-card-skeleton-body">
                <div className="product-card-skeleton-line product-card-skeleton-line--title" />
                <div className="product-card-skeleton-line product-card-skeleton-line--meta" />
                <div className="product-card-skeleton-line product-card-skeleton-line--price" />
                <div className="product-card-skeleton-line" />
                <div className="product-card-skeleton-line product-card-skeleton-line--short" />
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [sort, setSort] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hero, setHero] = useState(null);
    const [heroLoading, setHeroLoading] = useState(false);
    const [viewer, setViewer] = useState(null);

    useEffect(() => {
        let cancelled = false;
        axios.get('/api/me')
            .then((res) => {
                if (!cancelled) setViewer(res.data?.user || null);
            })
            .catch(() => {
                if (!cancelled) setViewer(null);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setHeroLoading(true);
        fetch('/api/boards/active')
            .then((res) => {
                if (!res.ok) throw new Error('Failed hero');
                return res.json();
            })
            .then((data) => {
                if (!cancelled) setHero(data.board || data.banner || null);
            })
            .catch(() => {
                if (!cancelled) setHero(null);
            })
            .finally(() => {
                if (!cancelled) setHeroLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.append('q', search);
        if (category) params.append('category', category);
        if (sort) params.append('sort', sort);

        setLoading(true);
        setError('');

        fetch(`/api/products?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load products');
                return res.json();
            })
            .then((data) => {
                setProducts(data.products || []);
                setCategories(data.categories || []);
            })
            .catch(() => setError('Failed to load products. Try again.'))
            .finally(() => setLoading(false));
    }, [search, category, sort]);

    const showSkeleton = loading && products.length === 0;
    const showEmpty = !loading && products.length === 0 && !error;
    const showGrid = products.length > 0;

    const heroTitle = hero?.title ?? 'Wardrobe essentials, curated for you';
    const heroImageAlt = hero?.title
        ? `Board: ${hero.title}`
        : 'Promotional hero banner';
    const isAdminViewer = Boolean(viewer?.is_admin);

    return (
        <div className="page-container page-container--dashboard" id="product-dashboard">
            {isAdminViewer ? (
                <section className="customer-preview-banner" aria-label="Admin customer preview">
                    <div>
                        <strong>Viewing storefront as admin</strong>
                        <p>Use this mode to check the customer experience. Buying, cart, and checkout remain disabled for admin accounts.</p>
                    </div>
                    <Link to="/admin" className="customer-preview-banner__action">Back to admin</Link>
                </section>
            ) : null}

            <section
                className="dashboard-hero"
                aria-labelledby="dashboard-hero-heading"
                aria-busy={heroLoading}
            >
                <div className="dashboard-hero-copy">
                    <p className="dashboard-hero-eyebrow">{hero ? 'Promotion' : 'New season'}</p>
                    <h1 id="dashboard-hero-heading" className="dashboard-hero-title">
                        {heroTitle}
                    </h1>
                    <p className="dashboard-hero-sub">
                        {hero?.subtitle ?? DASHBOARD_HERO_DEFAULT_SUBTITLE}
                    </p>
                    {hero?.cta_text && hero?.cta_link ? (
                        isInternalAppHref(hero.cta_link) ? (
                            <Link to={hero.cta_link} className="dashboard-hero-cta">
                                {hero.cta_text}
                            </Link>
                        ) : (
                            <a
                                href={hero.cta_link}
                                className="dashboard-hero-cta"
                                {...heroCtaExternalAttrs(hero.cta_link)}
                            >
                                {hero.cta_text}
                            </a>
                        )
                    ) : null}
                </div>
                {hero?.image_url ? (
                    <div className="dashboard-hero-accent dashboard-hero-accent--has-media">
                        <img
                            src={hero.image_url}
                            alt={heroImageAlt}
                            className="dashboard-hero-img"
                            loading="lazy"
                            decoding="async"
                        />
                    </div>
                ) : (
                    <div className="dashboard-hero-accent" aria-hidden />
                )}
            </section>

            <section className="dashboard-catalog" aria-label="Product catalog">
                <div className="dashboard-catalog__toolbar product-toolbar-form">
                    <div className="product-filter-toolbar-cluster">
                        <div className="product-filter-group">
                            <label className="product-filter-label" htmlFor="filter-category">Category</label>
                            <select
                                id="filter-category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="product-filter-select"
                            >
                                <option value="">All categories</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="product-filter-group">
                            <label className="product-filter-label" htmlFor="filter-sort">Sort</label>
                            <select
                                id="filter-sort"
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                                className="product-filter-select"
                            >
                                <option value="">Featured</option>
                                <option value="price_asc">Price: low to high</option>
                                <option value="price_desc">Price: high to low</option>
                            </select>
                        </div>
                    </div>
                    <div className="product-filter-group product-filter-group--search">
                        <label className="product-filter-label" htmlFor="filter-search">Search</label>
                        <div className="product-search-wrap">
                            <input
                                id="filter-search"
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="product-filter-search-input"
                                placeholder="Search by name, brand, or description…"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                </div>

                <div className="dashboard-catalog__products product-view-panel">
                    {error && (
                        <div className="dashboard-state dashboard-state--error" role="alert">
                            <p className="dashboard-state-title">Something went wrong</p>
                            <p className="dashboard-state-text">{error}</p>
                        </div>
                    )}

                    {showSkeleton && (
                        <div className="products-cards-grid products-cards-grid--skeleton">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <ProductCardSkeleton key={i} />
                            ))}
                        </div>
                    )}

                    {showEmpty && (
                        <div className="dashboard-state dashboard-state--empty" role="status">
                            <p className="dashboard-state-title">No matches</p>
                            <p className="dashboard-state-text">
                                Try clearing filters or search keywords to see more products.
                            </p>
                        </div>
                    )}

                    {showGrid && (
                        <div className="products-cards-grid">
                            {products.map((product) => {
                                const variants = product.variants || [];
                                const inStock = variants.filter((v) => v.stock > 0);
                                const minPriceMmk = product.variants_min_price_mmk != null
                                    ? Number(product.variants_min_price_mmk)
                                    : (inStock.length > 0
                                        ? Math.min(...inStock.map((v) => Number(v.price_mmk)))
                                        : null);

                                return (
                                    <article key={product.id} className="product-card-dashboard">
                                        <Link to={`/products/${product.id}`} className="product-card-dashboard-media">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt="" className="product-card-dashboard-img" loading="lazy" />
                                            ) : (
                                                <div className="product-card-dashboard-placeholder">No image</div>
                                            )}
                                            {product.category ? (
                                                <span className="product-card-dashboard-badge">{product.category}</span>
                                            ) : null}
                                        </Link>
                                        <div className="product-card-dashboard-body">
                                            <h2 className="product-card-dashboard-title">
                                                <Link to={`/products/${product.id}`} className="product-link">{product.name}</Link>
                                            </h2>
                                            <p className="product-card-dashboard-meta">
                                                {product.brand || 'Unbranded'}
                                            </p>
                                            {minPriceMmk !== null && !Number.isNaN(minPriceMmk) && (
                                                <p className="product-card-dashboard-price">
                                                    From <span className="product-card-dashboard-price-value">{formatMMK(minPriceMmk)}</span>
                                                </p>
                                            )}
                                            <p className="product-card-dashboard-desc">
                                                {product.description ? `${product.description.slice(0, 110)}${product.description.length > 110 ? '…' : ''}` : ''}
                                            </p>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}


