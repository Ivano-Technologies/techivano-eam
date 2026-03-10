import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import { alias } from "./config/aliases";


const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginManusRuntime(),
  ...(process.env.ANALYZE === "true"
    ? [
        visualizer({
          filename: path.resolve(import.meta.dirname, "dist/public/stats.html"),
          gzipSize: true,
          open: false,
        }) as import("vite").Plugin,
      ]
    : []),
  VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
    manifest: {
      name: 'NRCS Enterprise Asset Management',
      short_name: 'NRCS EAM',
      description: 'Enterprise Asset Management System for NRCS',
      theme_color: '#1E3A5F',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB (app-logo.png ~2.25MB); JS chunks not precached
      // Precache only critical assets; avoid **/*.js to prevent precaching all large chunks
      globPatterns: ['**/*.css', '**/*.html', '**/*.ico', '**/*.png', '**/*.svg', '**/*.woff2', '**/manifest.webmanifest', '**/registerSW.js'],
      runtimeCaching: [
        {
          urlPattern: /^\/api\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: /\/assets\/.*\.js/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'js-assets',
            expiration: { maxEntries: 60, maxAgeSeconds: 86400 * 7 }
          }
        },
        {
          urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'image-cache',
            expiration: { maxEntries: 100, maxAgeSeconds: 2592000 }
          }
        }
      ]
    }
  })
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      ...alias,
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          "trpc-query": ["@trpc/client", "@trpc/react-query", "@tanstack/react-query"],
          superjson: ["superjson"],
          wouter: ["wouter"],
          sonner: ["sonner"],
          "next-themes": ["next-themes"],
          "form-libs": ["react-hook-form", "@hookform/resolvers", "zod"],
          "radix-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-select",
            "@radix-ui/react-popover",
            "@radix-ui/react-label",
          ],
          "framer-motion": ["framer-motion"],
          "lucide-react": ["lucide-react"],
          "date-fns": ["date-fns"],
          "html5-qrcode": ["html5-qrcode"],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
