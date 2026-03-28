import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 
                    'resources/css/login.css', 
                    'resources/css/product.css', 
                    'resources/js/app.js',
                    'resources/js/Login.jsx',
                    'resources/js/Register.jsx',
                    'resources/js/ProductFilter.jsx',
            ],
            refresh: true,
        }),
        react({ jsxRuntime: 'automatic' }),
    ],
});
