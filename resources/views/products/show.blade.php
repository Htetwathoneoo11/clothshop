@extends('layouts.app')

@section('title', $product->name)
@section('main-class', 'main-wrap')

@section('content')
    <div class="page-container product-detail">
        <div class="product-detail-back">
            <a href="{{ route('users.dashboard') }}" class="btn-back">&larr; Back to products</a>
        </div>

        <div class="product-detail-grid">
            <div class="product-detail-media">
                @if ($product->image_url)
                    <img src="{{ $product->image_url }}" alt="{{ $product->name }}" class="product-detail-image">
                @else
                    <div class="product-detail-placeholder">No image</div>
                @endif
            </div>
            <div class="product-detail-info">
                <p class="product-detail-meta">{{ $product->brand ?? 'Unbranded' }} . {{ $product->category }}</p>
                <h1 class="page-title product-detail-title">{{ $product->name }}</h1>
                <p class="product-detail-description">{{ $product->description }}</p>

                @php
                    $inStockVariants = $product->variants->filter(fn ($v) => $v->stock > 0);
                @endphp

                @if ($inStockVariants->isNotEmpty())
                    <div class="product-detail-variants-heading">Choose color & size</div>
                    @auth
                        <form action="{{ route('cart.add') }}" method="POST" class="variant-form product-detail-form" data-product-id="{{ $product->id }}">
                            @csrf
                            <div class="product-detail-selects">
                                <label class="product-detail-label">Color</label>
                                <select name="color" class="variant-color-select" data-product-id="{{ $product->id }}">
                                    @foreach ($inStockVariants->pluck('color')->unique() as $colorOption)
                                        <option value="{{ $colorOption }}">{{ $colorOption }}</option>
                                    @endforeach
                                </select>
                                <label class="product-detail-label">Size</label>
                                <select name="variant_id" class="variant-size-select" data-product-id="{{ $product->id }}">
                                    @foreach ($inStockVariants as $variant)
                                        <option value="{{ $variant->id }}" data-color="{{ $variant->color }}">
                                            {{ $variant->size }} — ${{ number_format((float) $variant->price, 2) }} ({{ $variant->stock }} in stock)
                                        </option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="product-detail-actions">
                                <button type="submit" class="btn-primary product-detail-add">Add to cart</button>
                                <a href="{{ route('checkout.index') }}" class="btn-primary product-detail-buy-now">Buy now</a>
                            </div>
                        </form>
                    @else
                        <p class="product-detail-login-hint">
                            <a href="{{ route('users.login') }}" class="btn-primary">Log in</a> to add this item to your cart.
                        </p>
                    @endauth

                    <div class="product-detail-table-wrap">
                        <table class="product-detail-table">
                            <thead>
                                <tr>
                                    <th>Color</th>
                                    <th>Size</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($product->variants as $variant)
                                    <tr class="{{ $variant->stock < 1 ? 'product-detail-row-oos' : '' }}">
                                        <td>{{ $variant->color }}</td>
                                        <td>{{ $variant->size }}</td>
                                        <td>${{ number_format((float) $variant->price, 2) }}</td>
                                        <td>{{ $variant->stock }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                @else
                    <p class="product-detail-oos">All variants are currently out of stock.</p>
                @endif
            </div>
        </div>
    </div>
@endsection

