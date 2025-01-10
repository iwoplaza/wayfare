// @ts-check
import typegpu from 'rollup-plugin-typegpu';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: {
    index: 'src/index.ts',
  },
  external: ['typegpu', /^typegpu\//, 'koota', 'wgpu-matrix', /^@loaders.gl\//],
  output: [
    {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    },
    {
      dir: 'dist',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  plugins: [typescript(), typegpu({ include: [/\.ts$/] }), terser()],
};
