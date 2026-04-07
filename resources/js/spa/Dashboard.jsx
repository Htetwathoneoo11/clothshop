import React, { useEffect, useState } from 'react';

export default function Dashboard() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [sort, setSort] = useState('');

    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.append('q', search);
        if (category) params.append('category', category);
        if (sort) params.append('sort', sort);

        fetch(`/api/products?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setProducts(data.products || []);
                setCategories(data.categories || []);
            });
    }, [search, category, sort]);

    return (
        <div className="page-container" id="product-dashboard">
            <div className="product-dashboard-actions">
                <div className="product-filter-bar product-toolbar-form">
                    <div className="product-filter-toolbar-cluster">
                        <div className="product-filter-group">
                            <label className="product-filter-label">Category</label>
                            <select
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
                            <label className="product-filter-label">Sort by:</label>
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                                className="product-filter-select"
                            >
                                <option value="">Default</option>
                                <option value="price_asc">Price low to high</option>
                                <option value="price_desc">Price high to low</option>
                            </select>
                        </div>
                    </div>
                    <div className="product-filter-group product-filter-group--search">
                        <label className="product-filter-label">Search</label>
                        <div className="product-search-wrap">
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="product-filter-search-input"
                                placeholder="Search products..."
                            />
                            <button type="button" className="product-search-btn">
                                Search
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="product-view-panel">
                {products.length === 0 ? (
                    <div className="product-dashboard-empty" role="status">
                        <p className="product-dashboard-empty-title">No products found</p>
                        <p className="product-dashboard-empty-hint">Try different filters.</p>
                    </div>
                ) : (
                    <div className="products-cards-grid">
                        {products.map((product) => (
                            <article key={product.id} className="product-card-dashboard">
                                <div className="product-card-dashboard-body">
                                    <h2 className="product-card-dashboard-title">{product.name}</h2>
                                    <p className="product-card-dashboard-meta">
                                        {product.brand || 'Unbranded'} - {product.category}
                                    </p>
                                    <p className="product-card-dashboard-desc">
                                        {product.description || ''}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
