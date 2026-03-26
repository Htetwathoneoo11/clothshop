@extends('layouts.app')

@section('title', 'Dashboard')
@section('main-class', 'main-wrap')

@section('content')
    <div class="page-container">
        <div class="page-header">
            <h1 class="page-title">Products</h1>
        </div>

        <form method="GET" action="{{ route('users.dashboard') }}" class="product-filter-bar">
            <input type="text" name="q" value="{{ $search }}" placeholder="Search by name, brand, description" class="product-filter-input">
            <select name="category" class="product-filter-select">
                <option value="">All categories</option>
                @foreach ($categories as $option)
                    <option value="{{ $option }}" {{ $category === $option ? 'selected' : '' }}>{{ $option }}</option>
                @endforeach
            </select>
            <button type="submit" class="btn-small btn-edit">Filter</button>
            <a href="{{ route('users.dashboard') }}" class="btn-small btn-delete">Reset</a>
        </form>

        <div class="grid-container">
            <div class="grid-header-simple">#</div>
            <div class="grid-header-simple">Product</div>
            <div class="grid-header-simple">Color</div>
            <div class="grid-header-simple">Size</div>
            <div class="grid-header-simple">Action</div>

            @forelse ($products as $product)
                <div class="grid-item-simple">{{ $loop->iteration }}</div>
                <div class="grid-item-simple">
                    @if ($product->image_url)
                        <img src="{{ $product->image_url }}" alt="{{ $product->name }}" class="product-thumb">
                    @endif
                    <strong>{{ $product->name }}</strong><br>
                    <small>{{ $product->brand ?? 'Unbranded' }} - {{ $product->category }}</small><br>
                    <small>{{ $product->description }}</small>
                </div>
                <div class="grid-item-simple product-variant-cell">
                    @php
                        $inStockVariants = $product->variants->filter(fn ($variant) => $variant->stock > 0);
                    @endphp
                    @if ($inStockVariants->isNotEmpty())
                        {{ $inStockVariants->pluck('color')->unique()->implode(', ') }}
                    @else
                        <span>Out of stock</span>
                    @endif
                </div>
                <div class="grid-item-simple product-variant-cell">
                    @if ($inStockVariants->isNotEmpty())
                        {{ $inStockVariants->pluck('size')->unique()->implode(', ') }}
                    @else
                        <span>-</span>
                    @endif
                </div>
                <div class="grid-item-simple">
                    @auth
                        @if ($inStockVariants->isNotEmpty())
                            <form action="{{ route('cart.add') }}" method="POST" class="variant-form" data-product-id="{{ $product->id }}">
                                @csrf
                                <select name="color" class="variant-color-select" data-product-id="{{ $product->id }}">
                                    @foreach ($inStockVariants->pluck('color')->unique() as $colorOption)
                                        <option value="{{ $colorOption }}">{{ $colorOption }}</option>
                                    @endforeach
                                </select>
                                <select name="variant_id" class="variant-size-select" data-product-id="{{ $product->id }}">
                                    @foreach ($inStockVariants as $variant)
                                        <option value="{{ $variant->id }}" data-color="{{ $variant->color }}">
                                            {{ $variant->size }} - ${{ number_format((float) $variant->price, 2) }} (Stock: {{ $variant->stock }})
                                        </option>
                                    @endforeach
                                </select>
                                <button type="submit" class="btn-small btn-edit">Add to Cart</button>
                            </form>
                        @else
                            <span>All variants out of stock</span>
                        @endif
                    @else
                        <a href="{{ route('users.login') }}" class="btn-small btn-edit">Login to buy</a>
                    @endauth
                </div>
            @empty
                <div class="no-data">No products available.</div>
            @endforelse
        </div>
    </div>
@endsection

@push('scripts')
<script>
    document.querySelectorAll('.variant-form').forEach((form) => {
        const productId = form.dataset.productId;
        const colorSelect = form.querySelector(`.variant-color-select[data-product-id="${productId}"]`);
        const sizeSelect = document.querySelector(`.variant-size-select[data-product-id="${productId}"]`);

        if (!colorSelect || !sizeSelect) return;

        const syncSizes = () => {
            const selectedColor = colorSelect.value;
            let firstVisible = null;

            [...sizeSelect.options].forEach((option) => {
                const visible = option.dataset.color === selectedColor;
                option.hidden = !visible;
                option.disabled = !visible;
                if (visible && !firstVisible) firstVisible = option;
            });

            if (firstVisible) {
                sizeSelect.value = firstVisible.value;
            }
        };

        colorSelect.addEventListener('change', syncSizes);
        syncSizes();
    });
</script>
@endpush
