import { POS_NORMAL_UV } from 'jolted/mesh';
import tgpu from 'typegpu/experimental';
import { struct, vec2f, vec3f, vec4f, builtin } from 'typegpu/data';
import { normalize, mul, max, dot, add } from 'typegpu/std';

import { createMaterial } from './material';

export const BlinnPhongMaterial = createMaterial(
  // schema
  struct({
    albedo: vec3f,
  }),

  // defaults
  { albedo: vec3f(1, 0, 1) },

  // shader
  ({ root, format, getPOV, getUniforms, getParams }) => {
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
);
