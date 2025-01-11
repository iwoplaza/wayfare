// @ts-check
import typegpu from 'rollup-plugin-typegpu';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: 'src/index.ts',
  external: ['typegpu', /^typegpu\//, 'koota', 'wgpu-matrix', /^@loaders.gl\//],
  output: [
    {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  plugins: [typescript(), typegpu({ include: [/\.ts$/] }), terser()],
};
