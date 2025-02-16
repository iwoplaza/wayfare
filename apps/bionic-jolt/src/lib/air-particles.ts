import { type World, trait } from 'koota';
import {
  builtin,
  disarrayOf,
  f32,
  mat3x3f,
  struct,
  vec2f,
  vec3f,
  vec4f,
  type F32,
  type Vec3f,
  type WgslStruct,
} from 'typegpu/data';
import tgpu, { type TgpuRoot } from 'typegpu';
import { add, cos, fract, length, mul, sin, sub } from 'typegpu/std';
import {
  ActiveCameraTag,
  InstanceBufferTrait,
  MeshTrait,
  POS_NORMAL_UV,
  Time,
  TransformTrait,
  createMaterial,
  createRectangle,
  getOrThrow,
} from 'wayfare';

const particleAmount = 1000;
const span = 10;

const AirParticleSystem = trait({});

export const InstanceLayout = tgpu.vertexLayout(
  (count: number) => disarrayOf(vec3f, count),
  'instance',
);

const particleMesh = createRectangle({
  width: vec3f(0.02, 0, 0),
  height: vec3f(0, 0.5, 0),
});

// TODO: Contribute back to `typegpu`
const atan2 = tgpu['~unstable']
  .fn([f32, f32], f32)
  .does(`(y: f32, x: f32) -> f32 {
  return atan2(y, x);
}`);

// TODO: Contribute back to `typegpu`
const discard = tgpu['~unstable'].fn([]).does(`() {
  discard;
}`);

export const AirParticlesMaterial = createMaterial<
  WgslStruct<{ cameraPosition: Vec3f; yOffset: F32 }>
>({
  paramsSchema: struct({
    cameraPosition: vec3f,
    yOffset: f32,
  }),
  paramsDefaults: {
    cameraPosition: vec3f(),
    yOffset: 0,
  },
  vertexLayout: POS_NORMAL_UV,
  instanceLayout: InstanceLayout,
  createPipeline({ root, format, getPOV, getUniforms, getParams }) {
    const getTransformedOrigin = tgpu['~unstable']
      .fn([vec3f], vec3f)
      .does((localOrigin) => {
        const wrappedOrigin = sub(
          localOrigin,
          getParams().value.cameraPosition,
        );
        wrappedOrigin.y -= getParams().value.yOffset;

        // wrapping the space.
        wrappedOrigin.y = -fract(-wrappedOrigin.y / span) * span;
        wrappedOrigin.x =
          (fract(wrappedOrigin.x / span / 2 + 0.5) - 0.5) * span * 2;
        wrappedOrigin.z =
          (fract(wrappedOrigin.z / span / 2 + 0.5) - 0.5) * span * 2;

        return wrappedOrigin;
      });

    const computePosition = tgpu['~unstable']
      .fn([vec3f, vec3f], vec3f)
      .does((pos, cameraRelToCamera) => {
        const angle =
          -atan2(cameraRelToCamera.x, cameraRelToCamera.z) + Math.PI;
        const rot_mat = mat3x3f(
          vec3f(cos(angle), 0, sin(angle)), // i
          vec3f(0, 1, 0), // j
          vec3f(-sin(angle), 0, cos(angle)), // k
        );

        return add(mul(rot_mat, pos), cameraRelToCamera);
      });

    const Varying = {
      normal: vec3f,
      uv: vec2f,
      originRelToCamera: vec3f,
    } as const;

    const vertexFn = tgpu['~unstable']
      .vertexFn({
        in: {
          pos: vec3f,
          normal: vec3f,
          uv: vec2f,
          origin: vec3f,
        },
        out: {
          pos: builtin.position,
          ...Varying,
        },
      })
      .does((input) => {
        const pov = getPOV().value;
        const uniforms = getUniforms().value;
        const originRelToCamera = getTransformedOrigin(input.origin);
        const posRelToCamera = computePosition(input.pos, originRelToCamera);
        const posRelToCamera4 = vec4f(
          posRelToCamera.x,
          posRelToCamera.y,
          posRelToCamera.z,
          1,
        );
        const normal4 = vec4f(
          input.normal.x,
          input.normal.y,
          input.normal.z,
          0,
        );

        return {
          pos: mul(mul(pov.viewProjMat, uniforms.modelMat), posRelToCamera4),
          normal: mul(uniforms.normalModelMat, normal4).xyz,
          uv: input.uv,
          originRelToCamera: originRelToCamera,
        };
      });

    const fragmentFn = tgpu['~unstable']
      .fragmentFn({ in: Varying, out: vec4f })
      .does((input) => {
        const xz_dist = length(input.originRelToCamera.xz);
        if (xz_dist < 1) {
          discard();
        }
        return vec4f(1, 1, 1, 1.0);
      });

    return {
      pipeline: root['~unstable']
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

export function createAirParticles(world: World, root: TgpuRoot) {
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

  return {
    update() {
      const time = getOrThrow(world, Time);
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
          params.yOffset -= time.deltaSeconds * 10;
        });
    },
  };
}
