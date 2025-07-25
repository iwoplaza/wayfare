import typegpu from 'unplugin-typegpu/rolldown';
import { defineConfig } from 'tsdown';

export default defineConfig({
  platform: 'neutral',
  plugins: [
    typegpu({}),
  ],
});
