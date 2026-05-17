// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  site: 'https://sulphur-swarm.github.io',
  vite: {
    plugins: [tailwindcss()],
  },
});
