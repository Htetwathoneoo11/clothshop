import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 
                    'resources/css/login.css', 
                    'resources/css/product.css',
                    'resources/js/spa/main.jsx',
            ],
            refresh: true,
        }),
        react(),
    ],
});
