// @ts-check
import { defineConfig } from 'astro/config';
import typegpu from 'rollup-plugin-typegpu';

// https://astro.build/config
export default defineConfig({
  base: 'bionic-jolt',
  vite: {
    plugins: [typegpu({ include: [/\.ts$/] })],
    resolve: {
      alias: {
        renia: '/src/lib/engine',
      },
    },
  },
});
