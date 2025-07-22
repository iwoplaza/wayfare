import typegpu from 'unplugin-typegpu/rolldown';
import { defineConfig } from 'tsdown';
import AutoImport from 'unplugin-auto-import/rollup';

export default defineConfig({
  platform: 'neutral',
  dts: true,
  plugins: [
    AutoImport({
      imports: [
        {
          typegpu: ['tgpu'],
          'typegpu/data': [
            'builtin',
            'struct',
            'f32',
            'i32',
            'u32',
            'vec2f',
            'vec3f',
            'vec4f',
            'mat4x4f',
            ['*', 'd'],
          ],
          'typegpu/std': [
            'mul',
            'add',
            'dot',
            'max',
            'normalize',
            ['*', 'std'],
          ],
        },
      ],
    }),
    typegpu({}),
  ],
});
