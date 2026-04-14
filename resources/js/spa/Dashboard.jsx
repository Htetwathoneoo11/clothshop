import React, { useEffect, useState } from 'react';

export default function Dashboard() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [sort, setSort] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');


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
                        {loading && <p>Loading products...</p>}
                        {error && <p className="error-message">{error}</p>}
                    </div>
                ) : (
                    <div className="products-cards-grid">
                        {products.map((product) => {
                            const variants = product.variants || [];
                            const inStock = variants.filter(v => v.stock > 0);
                            const minPrice = inStock.length > 0
                                ? Math.min(...inStock.map(v => Number(v.price)))
                                : null;

                            return (
                                <article key={product.id} className="product-card-dashboard">
                                    <a href={`/products/${product.id}`} className="product-card-dashboard-media">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="product-card-dashboard-img" />
                                        ) : (
                                            <div className="product-card-dashboard-placeholder">No image</div>
                                        )}
                                    </a>
                                    <div className="product-card-dashboard-body">
                                        <h2 className="product-card-dashboard-title">
                                            <a href={`/products/${product.id}`} className="product-link">{product.name}</a>
                                        </h2>
                                        <p className="product-card-dashboard-meta">
                                            {product.brand || 'Unbranded'} - {product.category}
                                        </p>
                                        {minPrice !== null && (
                                            <p className="product-card-dashboard-price">
                                                ${minPrice.toFixed(2)}
                                            </p>
                                        )}
                                        <p className="product-card-dashboard-desc">
                                            {product.description ? product.description.slice(0, 120) : ''}
                                        </p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
