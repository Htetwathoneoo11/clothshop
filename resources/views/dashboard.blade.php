@extends('layouts.app')

@section('title', 'Dashboard')
@section('main-class', 'main-wrap')

@section('content')
    <div class="page-container" id="product-dashboard">
        <div class="product-dashboard-content">
            <div class="product-dashboard-actions">
                <div
                    id="product-filter-root"
                    data-action="{{ route('users.dashboard') }}"
                    data-search="{{ $search }}"
                    data-category="{{ $category }}"
                    data-sort="{{ $sort }}"
                    data-categories='@json($categories)'
                ></div>
            </div>

            <div class="product-view-panel">
                @if ($products->isEmpty())
                    <div class="no-data no-data--block">No products available.</div>
                @else
                    <div class="products-cards-grid">
                        @foreach ($products as $product)
                            @php
                                $inStockVariants = $product->variants->filter(fn ($variant) => $variant->stock > 0);
                            @endphp
                            <article class="product-card-dashboard">
                                <a href="{{ route('products.show', $product) }}" class="product-card-dashboard-media">
                                    @if ($product->image_url)
                                        <img src="{{ $product->image_url }}" alt="" class="product-card-dashboard-img">
                                    @else
                                        <div class="product-card-dashboard-placeholder">No image</div>
                                    @endif
                                </a>
                                <div class="product-card-dashboard-body">
                                    <h2 class="product-card-dashboard-title">
                                        <a href="{{ route('products.show', $product) }}" class="product-link">{{ $product->name }}</a>
                                    </h2>
                                    <p class="product-card-dashboard-meta">{{ $product->brand ?? 'Unbranded' }} . {{ $product->category }}</p>
                                    @if ($inStockVariants->isNotEmpty())
                                        @php
                                            $minVariantPrice = (float) $inStockVariants->min('price');
                                        @endphp
                                        <p class="product-card-dashboard-price">
                                                ${{ number_format($minVariantPrice, 2) }}
                                        </p>
                                    @endif
                                    <p class="product-card-dashboard-desc">{{ \Illuminate\Support\Str::limit($product->description ?? '', 120) }}</p>
                                    @auth
                                        @if ($inStockVariants->isNotEmpty())
                                            <form action="{{ route('cart.add') }}" method="POST" class="variant-form product-card-dashboard-form" data-product-id="card-{{ $product->id }}">
                                                @csrf
                                                <div class="product-card-dashboard-selects">
                                                    <select name="color" class="variant-color-select" data-product-id="card-{{ $product->id }}">
                                                        @foreach ($inStockVariants->pluck('color')->unique() as $colorOption)
                                                            <option value="{{ $colorOption }}">{{ $colorOption }}</option>
                                                        @endforeach
                                                    </select>
                                                    <select name="variant_id" class="variant-size-select" data-product-id="card-{{ $product->id }}">
                                                        @foreach ($inStockVariants as $variant)
                                                            <option value="{{ $variant->id }}" data-color="{{ $variant->color }}">
                                                                {{ $variant->size }} — ${{ number_format((float) $variant->price, 2) }} ({{ $variant->stock }})
                                                            </option>
                                                        @endforeach
                                                    </select>
                                                </div>
                                                <button type="submit" class="btn-small btn-edit product-card-dashboard-btn">Add to Cart</button>
                                            </form>
                                        @else
                                            <p class="product-card-dashboard-oos">Out of stock</p>
                                        @endif
                                    @endauth
                                </div>
                            </article>
                        @endforeach
                    </div>
                @endif
                </div>
            </div>
        </div>
    </div>
@endsection

