import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  ssr: false,
  server: {
    preset: 'static',
    baseURL: '/chat/',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});