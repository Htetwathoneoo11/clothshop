@extends('layouts.app')

@section('title', 'Checkout')
@section('main-class', 'main-wrap')

@section('content')
    <div class="page-container">
        <div class="page-header">
            <h1 class="page-title">Checkout</h1>
        </div>

        <div class="grid-container">
            <div class="grid-header-simple">Product</div>
            <div class="grid-header-simple">Unit Price</div>
            <div class="grid-header-simple">Quantity</div>
            <div class="grid-header-simple">Line Total</div>
            <div class="grid-header-simple">Status</div>

            @foreach ($items as $item)
                <div class="grid-item-simple">
                    {{ $item->variant->product->name }}<br>
                    <small>{{ $item->variant->color }} / {{ $item->variant->size }}</small>
                </div>
                <div class="grid-item-simple">${{ number_format((float) $item->unit_price, 2) }}</div>
                <div class="grid-item-simple">{{ $item->quantity }}</div>
                <div class="grid-item-simple">${{ number_format((float) ($item->unit_price * $item->quantity), 2) }}</div>
                <div class="grid-item-simple">Ready</div>
            @endforeach
        </div>

        <div style="margin-top: 20px; text-align: right; font-size: 18px; font-weight: 700;">
            Total: ${{ number_format((float) $subtotal, 2) }}
        </div>

        <form action="{{ route('checkout.store') }}" method="POST" style="margin-top: 18px; text-align: right;">
            @csrf
            <button type="submit" class="btn-primary">Confirm Checkout</button>
        </form>
    </div>
@endsection
