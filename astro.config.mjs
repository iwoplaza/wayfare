// @ts-check
import { defineConfig } from 'astro/config';
import typegpu from 'rollup-plugin-typegpu';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [typegpu({ include: [/\.ts$/] })],
  },
});
