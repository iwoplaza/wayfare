// @ts-check
import { defineConfig } from 'astro/config';
import typegpu from 'unplugin-typegpu/rollup';

import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  base: 'wayfare',

  vite: {
    plugins: [typegpu({ include: [/\.ts$/] })],
  },

  integrations: [tailwind()],
});
