// vite.config.js - Complete Fixed Version with `@` alias + proxy
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: [
                    ['styled-jsx/babel', {
                        optimizeForSpeed: true,
                        sourceMaps: true,
                        vendorPrefixes: false,
                    }],
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"), // ✅ allows '@/context/AuthProvider'
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, '/api'),
            },
        }

    },
});
