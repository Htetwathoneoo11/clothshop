import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';

function ProductFilter({
    actionUrl,
    initialSearch,
    initialCategory,
    initialSort,
    categories,
}) {
    const formRef = useRef(null);
    const [search, setSearch] = useState(initialSearch ?? '');
    const [category, setCategory] = useState(initialCategory ?? '');
    const [sort, setSort] = useState(initialSort ?? '');

    const safeCategories = Array.isArray(categories) ? categories : [];

    const submitFilter = () => {
        requestAnimationFrame(() => {
            if (formRef.current) {
                formRef.current.submit();
            }
        });
    };

    return (
        <form ref={formRef} method="GET" action={actionUrl} className="product-filter-bar product-toolbar-form">
            <div className="product-filter-toolbar-cluster">
                <div className="product-filter-group">
                    <label htmlFor="dashboard-category-filter" className="product-filter-label">Category</label>
                    <select
                        id="dashboard-category-filter"
                        name="category"
                        value={category}
                        onChange={(e) => {
                            setCategory(e.target.value);
                            submitFilter();
                        }}
                        className="product-filter-select"
                        aria-label="Category"
                    >
                        <option value="">All categories</option>
                        {safeCategories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="product-filter-group">
                    <label htmlFor="dashboard-sort-filter" className="product-filter-label">Sort by:</label>
                    <select
                        id="dashboard-sort-filter"
                        name="sort"
                        value={sort}
                        onChange={(e) => {
                            setSort(e.target.value);
                            submitFilter();
                        }}
                        className="product-filter-select"
                        aria-label="Sort products"
                    >
                        <option value="">Default</option>
                        <option value="price_asc">Price low to high</option>
                        <option value="price_desc">Price high to low</option>
                    </select>
                </div>
            </div>
            <div className="product-filter-group product-filter-group--search">
                <label htmlFor="dashboard-search-filter" className="product-filter-label">Search</label>
                <div className="product-search-wrap">
                    <input
                        id="dashboard-search-filter"
                        type="search"
                        name="q"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="product-filter-search-input"
                        placeholder="Search products..."
                        aria-label="Search products"
                    />
                    <button type="submit" className="product-search-btn">
                        Search
                    </button>
                </div>
            </div>
        </form>
    );
}

const container = document.getElementById('product-filter-root');
if (container) {
    let categories = [];
    try {
        const raw = container.dataset.categories || '[]';
        const parsed = JSON.parse(raw);
        categories = Array.isArray(parsed) ? parsed : [];
    } catch {
        categories = [];
    }

    const root = createRoot(container);
    root.render(
        <ProductFilter
            actionUrl={container.dataset.action || ''}
            initialSearch={container.dataset.search ?? ''}
            initialCategory={container.dataset.category ?? ''}
            initialSort={container.dataset.sort ?? ''}
            categories={categories}
        />
    );
}
