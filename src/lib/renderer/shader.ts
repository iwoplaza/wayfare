import {
  type Infer,
  builtin,
  mat4x4f,
  struct,
  vec2f,
  vec3f,
  vec4f,
} from 'typegpu/data';
import tgpu, { type TgpuBindGroup } from 'typegpu/experimental';
import { add, dot, max, mul, normalize } from 'typegpu/std';

export const Material = struct({
  albedo: vec3f,
}).$name('Material');

export type Material = Infer<typeof Material>;

export const UniformsStruct = struct({
  modelMat: mat4x4f,
  normalModelMat: mat4x4f,
  material: Material,
}).$name('Uniforms');

export const POVStruct = struct({
  viewProjMat: mat4x4f,
}).$name('POV');

export const sharedBindGroupLayout = tgpu
  .bindGroupLayout({
    pov: { uniform: POVStruct },
  })
  .$name('shared');

export const uniformsBindGroupLayout = tgpu
  .bindGroupLayout({
    uniforms: { uniform: UniformsStruct },
  })
  .$name('uniforms');

const { uniforms } = uniformsBindGroupLayout.bound;

export type UniformsBindGroup = TgpuBindGroup<
  (typeof uniformsBindGroupLayout)['entries']
>;

export const vertexFn = tgpu
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
    uniforms,
    pov: sharedBindGroupLayout.bound.pov,
  });

const sunDir = normalize(vec3f(-0.5, 2, -0.5));

const computeColor = tgpu.fn([vec3f], vec4f).does((normal) => {
  const diffuse = vec3f(1.0, 0.9, 0.7);
  const ambient = vec3f(0.1, 0.15, 0.2);
  const att = max(0, dot(normalize(normal), sunDir));
  const albedo = uniforms.value.material.albedo;

  const finalColor = mul(add(ambient, mul(att, diffuse)), albedo);
  return vec4f(finalColor.x, finalColor.y, finalColor.z, 1.0);
});

export const fragmentFn = tgpu
  .fragmentFn({}, vec4f)
  .does(`(@location(0) normal: vec3f, @location(1) uv: vec2f) -> @location(0) vec4f {
    return computeColor(normal);
  }`)
  .$uses({ computeColor });
