<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            [
                'name' => 'Classic T-Shirt',
                'category' => 'Topwear',
                'brand' => 'ThreadLine',
                'description' => 'Soft cotton t-shirt for daily wear.',
                'image_url' => 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
                'variants' => [
                    ['color' => 'Black', 'size' => 'S', 'price' => 19.99, 'stock' => 12, 'sku' => 'TSHIRT-BLK-S'],
                    ['color' => 'Black', 'size' => 'M', 'price' => 19.99, 'stock' => 16, 'sku' => 'TSHIRT-BLK-M'],
                    ['color' => 'White', 'size' => 'M', 'price' => 19.99, 'stock' => 14, 'sku' => 'TSHIRT-WHT-M'],
                ],
            ],
            [
                'name' => 'Denim Jacket',
                'category' => 'Outerwear',
                'brand' => 'BluePeak',
                'description' => 'Regular fit blue denim jacket.',
                'image_url' => 'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504',
                'variants' => [
                    ['color' => 'Blue', 'size' => 'M', 'price' => 59.99, 'stock' => 9, 'sku' => 'JACKET-BLU-M'],
                    ['color' => 'Blue', 'size' => 'L', 'price' => 59.99, 'stock' => 7, 'sku' => 'JACKET-BLU-L'],
                    ['color' => 'Grey', 'size' => 'L', 'price' => 62.99, 'stock' => 5, 'sku' => 'JACKET-GRY-L'],
                ],
            ],
            [
                'name' => 'Slim Chinos',
                'category' => 'Bottomwear',
                'brand' => 'UrbanMove',
                'description' => 'Comfortable slim-fit chinos.',
                'image_url' => 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a',
                'variants' => [
                    ['color' => 'Khaki', 'size' => '30', 'price' => 39.99, 'stock' => 10, 'sku' => 'CHINO-KHK-30'],
                    ['color' => 'Khaki', 'size' => '32', 'price' => 39.99, 'stock' => 11, 'sku' => 'CHINO-KHK-32'],
                    ['color' => 'Navy', 'size' => '32', 'price' => 41.99, 'stock' => 8, 'sku' => 'CHINO-NVY-32'],
                ],
            ],
            [
                'name' => 'Hoodie',
                'category' => 'Topwear',
                'brand' => 'NorthFleece',
                'description' => 'Fleece hoodie for cool weather.',
                'image_url' => 'https://images.unsplash.com/photo-1556821840-3a63f95609a7',
                'variants' => [
                    ['color' => 'Grey', 'size' => 'M', 'price' => 45.00, 'stock' => 10, 'sku' => 'HOODIE-GRY-M'],
                    ['color' => 'Grey', 'size' => 'L', 'price' => 45.00, 'stock' => 8, 'sku' => 'HOODIE-GRY-L'],
                    ['color' => 'Olive', 'size' => 'L', 'price' => 47.00, 'stock' => 7, 'sku' => 'HOODIE-OLV-L'],
                ],
            ],
            [
                'name' => 'Polo Shirt',
                'category' => 'Topwear',
                'brand' => 'OfficeFit',
                'description' => 'Smart casual polo shirt.',
                'image_url' => 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633',
                'variants' => [
                    ['color' => 'Navy', 'size' => 'S', 'price' => 28.50, 'stock' => 11, 'sku' => 'POLO-NVY-S'],
                    ['color' => 'Navy', 'size' => 'M', 'price' => 28.50, 'stock' => 10, 'sku' => 'POLO-NVY-M'],
                    ['color' => 'Maroon', 'size' => 'L', 'price' => 29.50, 'stock' => 6, 'sku' => 'POLO-MRN-L'],
                ],
            ],
            [
                'name' => 'Cargo Pants',
                'category' => 'Bottomwear',
                'brand' => 'Terrain',
                'description' => 'Relaxed fit cargo pants.',
                'image_url' => 'https://images.unsplash.com/photo-1517438476312-10d79c077509',
                'variants' => [
                    ['color' => 'Black', 'size' => '30', 'price' => 49.00, 'stock' => 8, 'sku' => 'CARGO-BLK-30'],
                    ['color' => 'Black', 'size' => '32', 'price' => 49.00, 'stock' => 9, 'sku' => 'CARGO-BLK-32'],
                    ['color' => 'Olive', 'size' => '34', 'price' => 51.00, 'stock' => 7, 'sku' => 'CARGO-OLV-34'],
                ],
            ],
            [
                'name' => 'Linen Shirt',
                'category' => 'Topwear',
                'brand' => 'BreezeWear',
                'description' => 'Breathable linen shirt for warm days.',
                'image_url' => 'https://images.unsplash.com/photo-1483985988355-763728e1935b',
                'variants' => [
                    ['color' => 'Beige', 'size' => 'M', 'price' => 34.99, 'stock' => 8, 'sku' => 'LINEN-BEG-M'],
                    ['color' => 'White', 'size' => 'L', 'price' => 34.99, 'stock' => 7, 'sku' => 'LINEN-WHT-L'],
                ],
            ],
            [
                'name' => 'Wool Coat',
                'category' => 'Outerwear',
                'brand' => 'FrostLine',
                'description' => 'Tailored wool coat for winter styling.',
                'image_url' => 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246',
                'variants' => [
                    ['color' => 'Charcoal', 'size' => 'M', 'price' => 129.00, 'stock' => 5, 'sku' => 'COAT-CHR-M'],
                    ['color' => 'Camel', 'size' => 'L', 'price' => 134.00, 'stock' => 4, 'sku' => 'COAT-CML-L'],
                ],
            ],
        ];

        foreach ($products as $product) {
            $dbProduct = Product::updateOrCreate(
                ['name' => $product['name']],
                [
                    'category' => $product['category'],
                    'brand' => $product['brand'],
                    'description' => $product['description'],
                    'image_url' => $product['image_url'],
                    'is_active' => true,
                ]
            );

            foreach ($product['variants'] as $variant) {
                $dbProduct->variants()->updateOrCreate(
                    ['sku' => $variant['sku']],
                    $variant
                );
            }
        }
    }
}
