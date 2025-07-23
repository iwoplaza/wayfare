import { POS_NORMAL_UV } from '../mesh.ts';
import { type CreateMaterialResult, createMaterial } from './material.ts';

const ParamsSchema = struct({
  albedo: vec3f,
});

export const BlinnPhongMaterial: CreateMaterialResult<typeof ParamsSchema> =
  createMaterial({
    paramsSchema: ParamsSchema,
    paramsDefaults: { albedo: vec3f(1, 0, 1) },
    vertexLayout: POS_NORMAL_UV,

    createPipeline({ root, format, $$ }) {
      const vertexFn = tgpu['~unstable'].vertexFn({
        in: {
          idx: builtin.vertexIndex,
          pos: vec3f,
          normal: vec3f,
          uv: vec2f,
        },
        out: { pos: builtin.position, normal: vec3f, uv: vec2f },
      })((input) => {
        return {
          pos: mul(mul($$.viewProjMat, $$.modelMat), vec4f(input.pos, 1)),
          normal: mul($$.normalModelMat, vec4f(input.normal, 0)).xyz,
          uv: input.uv,
        };
      });

      const sunDir = normalize(vec3f(-0.5, 2, -0.5));

      const fragmentFn = tgpu['~unstable'].fragmentFn({
        in: { normal: vec3f },
        out: vec4f,
      })((input) => {
        const normal = normalize(input.normal);

        const diffuse = vec3f(1.0, 0.9, 0.7);
        const ambient = vec3f(0.1, 0.15, 0.2);
        const att = max(0, dot(normal, sunDir));

        const finalColor = mul(
          add(ambient, mul(att, diffuse)),
          $$.params.albedo,
        );
        return vec4f(finalColor, 1.0);
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
