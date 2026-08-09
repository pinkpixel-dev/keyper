import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 4173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'logo.png', 'robots.txt'],
      manifest: {
        name: 'Keyper - Secure Credential Management',
        short_name: 'Keyper',
        description: 'Self-hosted secure credential management for API keys, passwords, secrets, and more',
        theme_color: '#06B6D4',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'favicon.png',
            sizes: '48x48',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Exclude the problematic argon2-browser module to prevent Vite from trying to process it
    exclude: ['argon2-browser']
  },
  define: {
    // Fix for argon2-browser in production builds
    global: 'globalThis',
    // Polyfill Node.js modules for browser compatibility
    'process.env': {},
    // Single source of truth for the version shown in the UI. Injected here so
    // package.json is not bundled into the client and nothing has to be kept in
    // sync by hand. Read it through src/lib/app-info.ts, never hardcode it.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: (id) => {
        // Keep argon2-browser as external in certain contexts
        return id.includes('argon2.wasm')
      },
      output: {
        manualChunks: (id) => {
          // Handle Argon2 specifically
          if (id.includes('argon2-browser')) {
            return 'crypto';
          }
          
          // Vendor chunks
          if (id.includes('node_modules')) {
            // Keep React and React-DOM together in the default vendor chunk
            // to avoid breaking React's internal coordination
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            if (id.includes('react-router-dom')) {
              return 'router';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query';
            }
            if (id.includes('@supabase/supabase-js')) {
              return 'supabase';
            }
            if (id.includes('date-fns')) {
              return 'date-utils'; // Rename to avoid empty chunk
            }
            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
              return 'forms';
            }
            if (id.includes('next-themes')) {
              return 'themes';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('recharts')) {
              return 'charts';
            }
            
            // Radix UI groupings
            if (id.includes('@radix-ui/react-dialog') || 
                id.includes('@radix-ui/react-alert-dialog') ||
                id.includes('@radix-ui/react-popover') ||
                id.includes('@radix-ui/react-tooltip') ||
                id.includes('@radix-ui/react-hover-card')) {
              return 'radix-dialogs';
            }
            if (id.includes('@radix-ui/react-label') ||
                id.includes('@radix-ui/react-select') ||
                id.includes('@radix-ui/react-checkbox') ||
                id.includes('@radix-ui/react-radio-group') ||
                id.includes('@radix-ui/react-switch') ||
                id.includes('@radix-ui/react-slider') ||
                id.includes('@radix-ui/react-progress')) {
              return 'radix-forms';
            }
            if (id.includes('@radix-ui/react-dropdown-menu') ||
                id.includes('@radix-ui/react-context-menu') ||
                id.includes('@radix-ui/react-menubar') ||
                id.includes('@radix-ui/react-navigation-menu') ||
                id.includes('@radix-ui/react-tabs') ||
                id.includes('@radix-ui/react-accordion') ||
                id.includes('@radix-ui/react-collapsible')) {
              return 'radix-navigation';
            }
            if (id.includes('@radix-ui/react-toast') ||
                id.includes('@radix-ui/react-scroll-area') ||
                id.includes('@radix-ui/react-separator') ||
                id.includes('@radix-ui/react-aspect-ratio') ||
                id.includes('@radix-ui/react-avatar') ||
                id.includes('@radix-ui/react-slot') ||
                id.includes('@radix-ui/react-toggle')) {
              return 'radix-misc';
            }
            
            // Utility libraries
            if (id.includes('clsx') ||
                id.includes('class-variance-authority') ||
                id.includes('tailwind-merge') ||
                id.includes('tailwindcss-animate')) {
              return 'utils';
            }
            
            // UI extras
            if (id.includes('sonner') ||
                id.includes('cmdk') ||
                id.includes('vaul') ||
                id.includes('input-otp') ||
                id.includes('react-day-picker') ||
                id.includes('embla-carousel-react') ||
                id.includes('react-resizable-panels')) {
              return 'ui-extras';
            }
            
            // Default vendor chunk for other node_modules
            return 'vendor';
          }
        },
      }
    }
  },
}));
