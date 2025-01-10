import type { World } from 'koota';
import {
  MeshTrait,
  TransformTrait,
  InstanceBufferTrait,
  POS_NORMAL_UV,
  createRectangle,
  createMaterial,
} from 'wayfare';
import { builtin, disarrayOf, vec2f, vec3f, vec4f } from 'typegpu/data';
import tgpu, {
  type ExperimentalTgpuRoot as TgpuRoot,
} from 'typegpu/experimental';
import { normalize, max, dot, mul, add } from 'typegpu/std';

export const SpeedLinesInstanceLayout = tgpu.vertexLayout(
  (count) => disarrayOf(vec3f, count),
  'instance',
);

const particleMesh = createRectangle({
  width: vec3f(1, 0, 0),
  height: vec3f(0, 1, 0),
});

export const SpeedLinesMaterial = createMaterial({
  vertexLayout: POS_NORMAL_UV,
  instanceLayout: SpeedLinesInstanceLayout,
  createPipeline({ root, format, getPOV, getUniforms, getParams }) {
    const vertexFn = tgpu
      .vertexFn(
        {
          idx: builtin.vertexIndex,
          pos: vec3f,
          normal: vec3f,
          uv: vec2f,
          origin: vec3f,
        },
        { pos: builtin.position, normal: vec3f, uv: vec2f },
      )
      .does(`(
        @builtin(vertex_index) idx: u32,
        @location(0) pos: vec3f,
        @location(1) normal: vec3f,
        @location(2) uv: vec2f,
        @location(3) origin: vec3f,
      ) -> Output {
        var out: Output;
        out.pos = pov.viewProjMat * uniforms.modelMat * vec4f(pos + origin, 1.0);
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
      const albedo = vec3f(1, 1, 1);

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
        .withVertex(vertexFn, {
          ...POS_NORMAL_UV.attrib,
          origin: SpeedLinesInstanceLayout.attrib,
        })
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

export function createAirParticles(root: TgpuRoot) {
  return {
    init(world: World) {
      const speedLinesBuffer = root
        .createBuffer(
          SpeedLinesInstanceLayout.schemaForCount(1),
          Array.from({ length: 1 }).map(() =>
            vec3f(Math.random(), 0, Math.random()),
          ),
        )
        .$usage('vertex');

      world.spawn(
        MeshTrait(particleMesh),
        TransformTrait({
          position: vec3f(0, 0, -1),
          scale: vec3f(0.1),
        }),
        InstanceBufferTrait(speedLinesBuffer),
        ...SpeedLinesMaterial.Bundle(),
      );
    },

    update(world: World) {},
  };
}
