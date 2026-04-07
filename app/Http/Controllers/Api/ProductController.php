<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('q', ''));
        $category = trim((string) $request->query('category', ''));
        $sort = trim((string) $request->query('sort', ''));

        $products = Product::query()
            ->with(['variants' => fn ($query) => $query->orderBy('color')->orderBy('size')])
            ->withMin(['variants as variants_min_price' => function ($q) {
                $q->where('stock', '>', 0);
            }], 'price')
            ->where('is_active', true)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('name', 'like', '%' . $search . '%')
                        ->orWhere('brand', 'like', '%' . $search . '%')
                        ->orWhere('description', 'like', '%' . $search . '%');
                });
            })
            ->when($category !== '', fn ($query) => $query->where('category', $category))
            ->when($sort === 'price_asc', fn ($query) => $query->orderBy('variants_min_price')->orderBy('name'))
            ->when($sort === 'price_desc', fn ($query) => $query->orderByDesc('variants_min_price')->orderBy('name'))
            ->when(! in_array($sort, ['price_asc', 'price_desc'], true), fn ($query) => $query->orderBy('name'))
            ->get();

        $categories = Product::query()
            ->where('is_active', true)
            ->whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category');

        return response()->json([
            'products' => $products,
            'categories' => $categories,
        ]);
    }
}
