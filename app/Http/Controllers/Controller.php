<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function showDashboard(Request $request)
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

        return view('dashboard', compact('products', 'categories', 'search', 'category', 'sort'));
    }//showDashboard
}
