import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // Inertia + React en un chunk "framework" compartido
                    if (id.includes('node_modules/@inertiajs') ||
                        id.includes('node_modules/react-dom') ||
                        id.includes('node_modules/react/')) {
                        return 'framework';
                    }
                    // TanStack Query en su propio chunk
                    if (id.includes('node_modules/@tanstack')) {
                        return 'tanstack';
                    }
                    // Resto de node_modules → vendor
                    if (id.includes('node_modules/')) {
                        return 'vendor';
                    }
                },
            },
        },
        chunkSizeWarningLimit: 400,
    },
});
