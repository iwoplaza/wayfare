import { trait, type World } from 'koota';
import {
  MeshTrait,
  TransformTrait,
  InstanceBufferTrait,
  POS_NORMAL_UV,
  createRectangle,
  createMaterial,
  ActiveCameraTag,
} from 'wayfare';
import {
  builtin,
  disarrayOf,
  f32,
  mat3x3f,
  struct,
  vec2f,
  vec3f,
  vec4f,
} from 'typegpu/data';
import tgpu, {
  type ExperimentalTgpuRoot as TgpuRoot,
} from 'typegpu/experimental';
import { add, cos, sin, sub, fract } from 'typegpu/std';

const particleAmount = 1000;
const span = 20;

const AirParticleSystem = trait({});

export const InstanceLayout = tgpu.vertexLayout(
  (count) => disarrayOf(vec3f, count),
  'instance',
);

const particleMesh = createRectangle({
  width: vec3f(1, 0, 0),
  height: vec3f(0, 1, 0),
});

// TODO: Contribute back to `typegpu`
const atan2 = tgpu.fn([f32, f32], f32).does(`(y: f32, x: f32) -> f32 {
  return atan2(y, x);
}`);

// TODO: Contribute back to `typegpu`
const matMul3x3 = tgpu
  .fn([mat3x3f, vec3f], vec3f)
  .does(`(mat: mat3x3f, vec: vec3f) -> vec3f {
    return mat * vec;
  }`);

export const AirParticlesMaterial = createMaterial({
  paramsSchema: struct({
    cameraPosition: vec3f,
  }),
  paramsDefaults: {
    cameraPosition: vec3f(),
  },
  vertexLayout: POS_NORMAL_UV,
  instanceLayout: InstanceLayout,
  createPipeline({ root, format, getPOV, getUniforms, getParams }) {
    const getTransformedOrigin = tgpu.fn([vec3f], vec3f).does((localOrigin) => {
      const wrappedOrigin = sub(localOrigin, getParams().value.cameraPosition);

      // wrapping the space.
      wrappedOrigin.y = -fract(-wrappedOrigin.y / span) * span;
      wrappedOrigin.x =
        (fract(wrappedOrigin.x / span / 2 + 0.5) - 0.5) * span * 2;
      wrappedOrigin.z =
        (fract(wrappedOrigin.z / span / 2 + 0.5) - 0.5) * span * 2;

      return wrappedOrigin;
    });

    const computePosition = tgpu
      .fn([vec3f, vec3f], vec3f)
      .does((pos, cameraRelToCamera) => {
        const angle =
          -atan2(cameraRelToCamera.x, cameraRelToCamera.z) + Math.PI;
        const rot_mat = mat3x3f(
          vec3f(cos(angle), 0, sin(angle)), // i
          vec3f(0, 1, 0), // j
          vec3f(-sin(angle), 0, cos(angle)), // k
        );

        return add(matMul3x3(rot_mat, pos), cameraRelToCamera);
      });

    const vertexFn = tgpu
      .vertexFn(
        {
          idx: builtin.vertexIndex,
          pos: vec3f,
          normal: vec3f,
          uv: vec2f,
          origin: vec3f,
        },
        {
          pos: builtin.position,
          normal: vec3f,
          uv: vec2f,
          cameraRelToCamera: vec3f,
        },
      )
      .does(`(
        @builtin(vertex_index) idx: u32,
        @location(0) pos: vec3f,
        @location(1) normal: vec3f,
        @location(2) uv: vec2f,
        @location(3) origin: vec3f,
      ) -> Output {
        var out: Output;

        let cameraRelToCamera = getTransformedOrigin(origin);
        out.pos = pov.viewProjMat * uniforms.modelMat * vec4f(computePosition(pos, cameraRelToCamera), 1.0);
        out.normal = (uniforms.normalModelMat * vec4f(normal, 0.0)).xyz;
        out.uv = uv;
        out.cameraRelToCamera = cameraRelToCamera;
        return out;
      }`)
      .$uses({
        get uniforms() {
          return getUniforms();
        },
        get pov() {
          return getPOV();
        },
        getTransformedOrigin,
        computePosition,
      });

    const computeColor = tgpu.fn([], vec4f).does(() => {
      return vec4f(1, 0, 0, 1.0);
    });

    const fragmentFn = tgpu
      .fragmentFn({ cameraRelToCamera: vec3f }, vec4f)
      .does(`(@location(0) normal: vec3f, @location(1) uv: vec2f, @location(2) originRelToCamera: vec3f) -> @location(0) vec4f {
        let xz_dist = length(originRelToCamera.xz);
        if (xz_dist < 1) {
          discard;
        }
        return computeColor();
      }`)
      .$uses({ computeColor });

    return {
      pipeline: root
        .withVertex(vertexFn, {
          ...POS_NORMAL_UV.attrib,
          origin: InstanceLayout.attrib,
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
      const particlesBuffer = root
        .createBuffer(
          InstanceLayout.schemaForCount(particleAmount),
          Array.from({ length: particleAmount }).map(() =>
            vec3f(
              (Math.random() * 2 - 1) * span,
              (Math.random() * 2 - 1) * span,
              (Math.random() * 2 - 1) * span,
            ),
          ),
        )
        .$usage('vertex');

      world.spawn(
        AirParticleSystem,
        MeshTrait(particleMesh),
        TransformTrait,
        InstanceBufferTrait(particlesBuffer),
        ...AirParticlesMaterial.Bundle(),
      );
    },

    update(world: World) {
      const activeCamera = world.queryFirst(ActiveCameraTag);
      const cameraTransform = activeCamera?.get(TransformTrait);

      if (!cameraTransform) {
        console.warn('Using air particles with no active camera.');
        return;
      }

      world
        .query(TransformTrait, AirParticlesMaterial.Params, AirParticleSystem)
        .updateEach(([transform, params]) => {
          transform.position = cameraTransform.position;
          params.cameraPosition = cameraTransform.position;
        });
    },
  };
}
