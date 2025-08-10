import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import { POS_NORMAL_UV } from '../mesh.ts';
import { type CreateMaterialResult, createMaterial } from './material.ts';

const ParamsSchema = d.struct({
  albedo: d.vec3f,
});

export const BlinnPhongMaterial: CreateMaterialResult<typeof ParamsSchema> =
  createMaterial({
    paramsSchema: ParamsSchema,
    paramsDefaults: { albedo: d.vec3f(1, 0, 1) },
    vertexLayout: POS_NORMAL_UV,

    createPipeline({ root, format, $$ }) {
      const vertexFn = tgpu['~unstable'].vertexFn({
        in: {
          idx: d.builtin.vertexIndex,
          pos: d.vec3f,
          normal: d.vec3f,
          uv: d.vec2f,
        },
        out: { pos: d.builtin.position, normal: d.vec3f, uv: d.vec2f },
      })((input) => {
        return {
          pos: std.mul(
            std.mul($$.viewProjMat, $$.modelMat),
            d.vec4f(input.pos, 1),
          ),
          normal: std.mul($$.normalModelMat, d.vec4f(input.normal, 0)).xyz,
          uv: input.uv,
        };
      });

      const sunDir = std.normalize(d.vec3f(-0.5, 2, -0.5));

      const fragmentFn = tgpu['~unstable'].fragmentFn({
        in: { normal: d.vec3f },
        out: d.vec4f,
      })((input) => {
        const normal = std.normalize(input.normal);

        const diffuse = d.vec3f(1.0, 0.9, 0.7);
        const ambient = d.vec3f(0.1, 0.15, 0.2);
        const att = std.max(0, std.dot(normal, sunDir));

        const finalColor = std.mul(
          std.add(ambient, std.mul(att, diffuse)),
          $$.params.albedo,
        );
        return d.vec4f(finalColor, 1.0);
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
