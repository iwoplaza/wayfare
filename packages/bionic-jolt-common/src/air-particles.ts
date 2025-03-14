import { type World, trait } from 'koota';
import * as d from 'typegpu/data';
import tgpu, { type TgpuRoot } from 'typegpu';
import * as std from 'typegpu/std';
import * as wayfare from 'wayfare';

const particleAmount = 1000;
const span = 10;

const AirParticleSystem = trait();

export const InstanceLayout = tgpu.vertexLayout(
  (count: number) => d.disarrayOf(d.vec3f, count),
  'instance',
);

const particleMesh = wayfare.createRectangle({
  width: d.vec3f(0.02, 0, 0),
  height: d.vec3f(0, 0.5, 0),
});

export const AirParticlesMaterial = wayfare.createMaterial({
  paramsSchema: d.struct({
    cameraPosition: d.vec3f,
    yOffset: d.f32,
  }),
  paramsDefaults: {
    cameraPosition: d.vec3f(),
    yOffset: 0,
  },
  vertexLayout: wayfare.POS_NORMAL_UV,
  instanceLayout: InstanceLayout,
  createPipeline({ root, format, $$ }) {
    const getTransformedOrigin = tgpu['~unstable']
      .fn([d.vec3f], d.vec3f)
      .does((localOrigin) => {
        const wrappedOrigin = std.sub(localOrigin, $$.params.cameraPosition);
        wrappedOrigin.y -= $$.params.yOffset;

        // wrapping the space.
        wrappedOrigin.y = -std.fract(-wrappedOrigin.y / span) * span;
        wrappedOrigin.x =
          (std.fract(wrappedOrigin.x / span / 2 + 0.5) - 0.5) * span * 2;
        wrappedOrigin.z =
          (std.fract(wrappedOrigin.z / span / 2 + 0.5) - 0.5) * span * 2;

        return wrappedOrigin;
      });

    const computePosition = tgpu['~unstable']
      .fn([d.vec3f, d.vec3f], d.vec3f)
      .does((pos, cameraRelToCamera) => {
        const angle =
          -std.atan2(cameraRelToCamera.x, cameraRelToCamera.z) + Math.PI;
        const rot_mat = d.mat3x3f(
          d.vec3f(std.cos(angle), 0, std.sin(angle)), // i
          d.vec3f(0, 1, 0), // j
          d.vec3f(-std.sin(angle), 0, std.cos(angle)), // k
        );

        return std.add(std.mul(rot_mat, pos), cameraRelToCamera);
      });

    const Varying = {
      normal: d.vec3f,
      uv: d.vec2f,
      originRelToCamera: d.vec3f,
    } as const;

    const vertexFn = tgpu['~unstable']
      .vertexFn({
        in: {
          pos: d.vec3f,
          normal: d.vec3f,
          uv: d.vec2f,
          origin: d.vec3f,
        },
        out: {
          pos: d.builtin.position,
          ...Varying,
        },
      })
      .does((input) => {
        const originRelToCamera = getTransformedOrigin(input.origin);
        const posRelToCamera = computePosition(input.pos, originRelToCamera);

        return {
          pos: std.mul(
            std.mul($$.viewProjMat, $$.modelMat),
            d.vec4f(posRelToCamera, 1),
          ),
          normal: std.mul($$.normalModelMat, d.vec4f(input.normal, 0)).xyz,
          uv: input.uv,
          originRelToCamera: originRelToCamera,
        };
      });

    const fragmentFn = tgpu['~unstable']
      .fragmentFn({ in: Varying, out: d.vec4f })
      .does((input) => {
        const xz_dist = std.length(input.originRelToCamera.xz);
        if (xz_dist < 1) {
          std.discard();
        }
        return d.vec4f(1);
      });

    return {
      pipeline: root['~unstable']
        .withVertex(vertexFn, {
          ...wayfare.POS_NORMAL_UV.attrib,
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
        d.vec3f(
          (Math.random() * 2 - 1) * span,
          (Math.random() * 2 - 1) * span,
          (Math.random() * 2 - 1) * span,
        ),
      ),
    )
    .$usage('vertex');

  world.spawn(
    AirParticleSystem,
    wayfare.MeshTrait(particleMesh),
    wayfare.TransformTrait,
    wayfare.InstanceBufferTrait(particlesBuffer),
    ...AirParticlesMaterial.Bundle(),
  );

  return {
    update() {
      const time = wayfare.getOrThrow(world, wayfare.Time);
      const activeCamera = world.queryFirst(wayfare.ActiveCameraTag);
      const cameraTransform = activeCamera?.get(wayfare.TransformTrait);

      if (!cameraTransform) {
        console.warn('Using air particles with no active camera.');
        return;
      }

      world
        .query(
          wayfare.TransformTrait,
          AirParticlesMaterial.Params,
          AirParticleSystem,
        )
        .updateEach(([transform, params]) => {
          transform.position = cameraTransform.position;

          params.cameraPosition = cameraTransform.position;
          params.yOffset -= time.deltaSeconds * 10;
        });
    },
  };
}
