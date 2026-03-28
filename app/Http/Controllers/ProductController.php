<?php

namespace App\Http\Controllers;

use App\Models\Product;

class ProductController extends Controller
{
    public function show(Product $product)
    {
        if (! $product->is_active) {
            abort(404);
        }

        $product->load(['variants' => fn ($query) => $query->orderBy('color')->orderBy('size')]);

        return view('products.show', compact('product'));
    }
}
