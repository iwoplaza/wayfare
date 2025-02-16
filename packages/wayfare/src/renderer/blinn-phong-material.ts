import tgpu from 'typegpu';
import { builtin, struct, vec2f, vec3f, vec4f } from 'typegpu/data';
import { add, dot, max, mul, normalize } from 'typegpu/std';

import { POS_NORMAL_UV } from '../mesh.js';
import { type CreateMaterialResult, createMaterial } from './material.js';

const ParamsSchema = struct({
  albedo: vec3f,
});

export const BlinnPhongMaterial: CreateMaterialResult<typeof ParamsSchema> =
  createMaterial({
    paramsSchema: ParamsSchema,
    paramsDefaults: { albedo: vec3f(1, 0, 1) },
    vertexLayout: POS_NORMAL_UV,

    createPipeline({ root, format, getPOV, getUniforms, getParams }) {
      const vertexFn = tgpu['~unstable']
        .vertexFn({
          in: {
            idx: builtin.vertexIndex,
            pos: vec3f,
            normal: vec3f,
            uv: vec2f,
          },
          out: { pos: builtin.position, normal: vec3f, uv: vec2f },
        })
        .does((input) => {
          const uniforms = getUniforms().value;
          const pov = getPOV().value;

          const pos4 = vec4f(input.pos.x, input.pos.y, input.pos.z, 1.0);
          const normal4 = vec4f(
            input.normal.x,
            input.normal.y,
            input.normal.z,
            0.0,
          );

          return {
            pos: mul(mul(pov.viewProjMat, uniforms.modelMat), pos4),
            normal: mul(uniforms.normalModelMat, normal4).xyz,
            uv: input.uv,
          };
        });

      const sunDir = normalize(vec3f(-0.5, 2, -0.5));

      const fragmentFn = tgpu['~unstable']
        .fragmentFn({ in: { normal: vec3f }, out: vec4f })
        .does((input) => {
          const normal = input.normal;

          const diffuse = vec3f(1.0, 0.9, 0.7);
          const ambient = vec3f(0.1, 0.15, 0.2);
          const att = max(0, dot(normalize(normal), sunDir));
          const albedo = getParams().value.albedo;

          const finalColor = mul(add(ambient, mul(att, diffuse)), albedo);
          return vec4f(finalColor.x, finalColor.y, finalColor.z, 1.0);
        });

      return {
        pipeline: root['~unstable']
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
