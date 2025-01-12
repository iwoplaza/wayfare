// @ts-check
import { defineConfig } from 'astro/config';
import typegpu from 'rollup-plugin-typegpu';

// https://astro.build/config
export default defineConfig({
  base: 'wayfare',
  vite: {
    plugins: [typegpu({ include: [/\.ts$/] })],
  },
});
