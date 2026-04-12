import tgpu, { d, std } from 'typegpu';
import { POS_NORMAL_UV } from '../mesh.ts';
import { type CreateMaterialResult, createMaterial } from './material.ts';

const ParamsSchema = d.struct({
  albedo: d.vec3f,
});

export const BlinnPhongMaterial: CreateMaterialResult<typeof ParamsSchema> = createMaterial({
  paramsSchema: ParamsSchema,
  paramsDefaults: { albedo: d.vec3f(1, 0, 1) },
  vertexLayout: POS_NORMAL_UV,

  createPipeline({ root, format, $$ }) {
    const vertexFn = tgpu.vertexFn({
      in: {
        pos: d.vec3f,
        normal: d.vec3f,
        uv: d.vec2f,
      },
      out: { pos: d.builtin.position, normal: d.vec3f, uv: d.vec2f },
    })((input) => {
      'use gpu';
      const worldPos = $$.modelMat * d.vec4f(input.pos, 1);
      return {
        pos: $$.viewProjMat * worldPos,
        normal: ($$.normalModelMat * d.vec4f(input.normal, 0)).xyz,
        uv: input.uv,
      };
    });

    const sunDir = std.normalize(d.vec3f(-0.5, 2, -0.5));

    const fragmentFn = tgpu.fragmentFn({
      in: { normal: d.vec3f },
      out: d.vec4f,
    })((input) => {
      const normal = std.normalize(input.normal);

      const diffuse = d.vec3f(1.0, 0.9, 0.7);
      const ambient = d.vec3f(0.1, 0.15, 0.2);
      const att = std.max(0, std.dot(normal, sunDir));

      const finalColor = std.mul(ambient.add(diffuse.mul(att)), $$.params.albedo);

      return d.vec4f(finalColor, 1.0);
    });

    return {
      pipeline: root.createRenderPipeline({
        attribs: POS_NORMAL_UV.attrib,
        vertex: vertexFn,
        fragment: fragmentFn,
        targets: { format },
      }),
    };
  },
});
