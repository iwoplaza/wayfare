import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import typegpu from 'unplugin-typegpu/vite';

const DEV = process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [
    typegpu({ include: [/\.ts$/] }),
    {
      ...basicSsl(),
      apply(_, { mode }) {
        return DEV && mode === 'https';
      },
    },
  ],
});
