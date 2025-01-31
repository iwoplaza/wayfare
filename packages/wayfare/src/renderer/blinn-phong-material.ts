import {
  type Normal,
  builtin,
  struct,
  vec2f,
  vec3f,
  vec4f,
} from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { add, dot, max, mul, normalize } from 'typegpu/std';

import { POS_NORMAL_UV } from '../mesh.js';
import { type CreateMaterialResult, createMaterial } from './material.js';

const ParamsSchema = struct({
  albedo: vec3f,
});

export const BlinnPhongMaterial: CreateMaterialResult<
  Normal<typeof ParamsSchema>
> = createMaterial({
  paramsSchema: ParamsSchema,

  paramsDefaults: { albedo: vec3f(1, 0, 1) },

  vertexLayout: POS_NORMAL_UV,

  createPipeline({ root, format, getPOV, getUniforms, getParams }) {
    const vertexFn = tgpu
      .vertexFn(
        { idx: builtin.vertexIndex, pos: vec3f, normal: vec3f, uv: vec2f },
        { pos: builtin.position, normal: vec3f, uv: vec2f },
      )
      .does(`(
        @builtin(vertex_index) idx: u32,
        @location(0) pos: vec3f,
        @location(1) normal: vec3f,
        @location(2) uv: vec2f
      ) -> Output {
        var out: Output;
        out.pos = pov.viewProjMat * uniforms.modelMat * vec4f(pos, 1.0);
        out.normal = (uniforms.normalModelMat * vec4f(normal, 0.0)).xyz;
        out.uv = uv;
        return out;
      }`)
      .$uses({
        get uniforms() {
          return getUniforms();
        },
        get pov() {
          return getPOV();
        },
      });

    const sunDir = normalize(vec3f(-0.5, 2, -0.5));

    const computeColor = tgpu.fn([vec3f], vec4f).does((normal) => {
      const diffuse = vec3f(1.0, 0.9, 0.7);
      const ambient = vec3f(0.1, 0.15, 0.2);
      const att = max(0, dot(normalize(normal), sunDir));
      const albedo = getParams().value.albedo;

      const finalColor = mul(add(ambient, mul(att, diffuse)), albedo);
      return vec4f(finalColor.x, finalColor.y, finalColor.z, 1.0);
    });

    const fragmentFn = tgpu
      .fragmentFn({}, vec4f)
      .does(`(@location(0) normal: vec3f, @location(1) uv: vec2f) -> @location(0) vec4f {
        return computeColor(normal);
      }`)
      .$uses({ computeColor });

    return {
      pipeline: root
        .withVertex(vertexFn, POS_NORMAL_UV.attrib)
        .withFragment(fragmentFn, { format })
        .withPrimitive({ topology: 'triangle-list', cullMode: 'back' })
        .withDepthStencil({
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus',
        })
        .createPipeline(),
    };
  },
});
