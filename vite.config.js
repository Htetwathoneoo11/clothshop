import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css',
                    'resources/css/login.css',
                    'resources/css/product.css',
                    'resources/css/profile.css',
                    'resources/js/spa/main.jsx',
                    'resources/views/welcome.blade.php',
            ],
            refresh: true,
        }),
        react(),
    ],
});
