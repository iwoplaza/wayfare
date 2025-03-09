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
import {
  add,
  cos,
  fract,
  length,
  mul,
  sin,
  sub,
  atan2,
  discard,
} from 'typegpu/std';
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

const AirParticleSystem = trait();

export const InstanceLayout = tgpu.vertexLayout(
  (count: number) => disarrayOf(vec3f, count),
  'instance',
);

const particleMesh = createRectangle({
  width: vec3f(0.02, 0, 0),
  height: vec3f(0, 0.5, 0),
});

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
  createPipeline({ root, format, $$ }) {
    const getTransformedOrigin = tgpu['~unstable']
      .fn([vec3f], vec3f)
      .does((localOrigin) => {
        const wrappedOrigin = sub(localOrigin, $$.params.cameraPosition);
        wrappedOrigin.y -= $$.params.yOffset;

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
      .does(($) => {
        const originRelToCamera = getTransformedOrigin($.origin);
        const posRelToCamera = computePosition($.pos, originRelToCamera);

        return {
          pos: mul(mul($$.viewProjMat, $$.modelMat), vec4f(posRelToCamera, 1)),
          normal: mul($$.normalModelMat, vec4f($.normal, 0)).xyz,
          uv: $.uv,
          originRelToCamera: originRelToCamera,
        };
      });

    const fragmentFn = tgpu['~unstable']
      .fragmentFn({ in: Varying, out: vec4f })
      .does(($) => {
        const xz_dist = length($.originRelToCamera.xz);
        if (xz_dist < 1) {
          discard();
        }
        return vec4f(1);
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
