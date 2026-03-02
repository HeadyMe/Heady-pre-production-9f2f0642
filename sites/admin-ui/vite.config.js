import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 4401,
        proxy: {
            '/api': {
                target: 'http://localhost:3301',
                changeOrigin: true,
            },
        },
    },
});
