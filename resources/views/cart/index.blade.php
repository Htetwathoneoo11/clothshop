@extends('layouts.app')

@section('title', 'Cart')
@section('main-class', 'main-wrap')

@section('content')
    <div class="page-container">
        <div class="page-header">
            <h1 class="page-title">Your Cart</h1>
            @if ($items->isNotEmpty())
                <a href="{{ route('checkout.index') }}" class="btn-primary">Proceed to Checkout</a>
            @endif
        </div>

        <div class="grid-container">
            <div class="grid-header-simple">Product</div>
            <div class="grid-header-simple">Unit Price</div>
            <div class="grid-header-simple">Quantity</div>
            <div class="grid-header-simple">Line Total</div>
            <div class="grid-header-simple">Actions</div>

            @forelse ($items as $item)
                <div class="grid-item-simple">
                    {{ $item->variant->product->name }}<br>
                    <small>{{ $item->variant->color }} / {{ $item->variant->size }}</small>
                </div>
                <div class="grid-item-simple">${{ number_format((float) $item->unit_price, 2) }}</div>
                <div class="grid-item-simple">
                    <form action="{{ route('cart.update', $item) }}" method="POST" style="display: inline-flex; gap: 8px;">
                        @csrf
                        <input type="number" name="quantity" min="1" value="{{ $item->quantity }}" style="width: 72px; padding: 6px;">
                        <button type="submit" class="btn-small btn-edit">Update</button>
                    </form>
                </div>
                <div class="grid-item-simple">${{ number_format((float) ($item->unit_price * $item->quantity), 2) }}</div>
                <div class="grid-item-simple">
                    <form action="{{ route('cart.remove', $item) }}" method="POST">
                        @csrf
                        <button type="submit" class="btn-small btn-delete">Remove</button>
                    </form>
                </div>
            @empty
                <div class="no-data">Your cart is empty.</div>
            @endforelse
        </div>

        @if ($items->isNotEmpty())
            <div style="margin-top: 20px; text-align: right; font-size: 18px; font-weight: 700;">
                Subtotal: ${{ number_format((float) $subtotal, 2) }}
            </div>
        @endif
    </div>
@endsection
