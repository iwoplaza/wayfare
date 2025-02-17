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
} from 'typegpu/data';
import tgpu, { type TgpuRoot } from 'typegpu';
import { add, cos, fract, sin, sub } from 'typegpu/std';
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

export const InstanceLayout = tgpu['~unstable'].vertexLayout(
  (count) => disarrayOf(vec3f, count),
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
const matMul3x3 = tgpu['~unstable']
  .fn([mat3x3f, vec3f], vec3f)
  .does(`(mat: mat3x3f, vec: vec3f) -> vec3f {
    return mat * vec;
  }`);

export const AirParticlesMaterial = createMaterial({
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
      .does((pos, originRelToCamera) => {
        const angle =
          -atan2(originRelToCamera.x, originRelToCamera.z) + Math.PI;
        const rot_mat = mat3x3f(
          vec3f(cos(angle), 0, sin(angle)), // i
          vec3f(0, 1, 0), // j
          vec3f(-sin(angle), 0, cos(angle)), // k
        );

        return add(matMul3x3(rot_mat, pos), originRelToCamera);
      });

    const vertexFn = tgpu['~unstable']
      .vertexFn({
        in: {
          idx: builtin.vertexIndex,
          pos: vec3f,
          normal: vec3f,
          uv: vec2f,
          origin: vec3f,
        },
        out: {
          pos: builtin.position,
          normal: vec3f,
          uv: vec2f,
          originRelToCamera: vec3f,
        },
      })
      .does(/* wgsl */ `(input: VertexIn) -> Output {
        var out: Output;

        let originRelToCamera = getTransformedOrigin(input.origin);
        out.pos = pov.viewProjMat * uniforms.modelMat * vec4f(computePosition(input.pos, originRelToCamera), 1.0);
        out.normal = (uniforms.normalModelMat * vec4f(input.normal, 0.0)).xyz;
        out.uv = input.uv;
        out.originRelToCamera = originRelToCamera;
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

    const computeColor = tgpu['~unstable'].fn([], vec4f).does(() => {
      return vec4f(1, 1, 1, 1.0);
    });

    const fragmentFn = tgpu['~unstable']
      .fragmentFn({ in: { originRelToCamera: vec3f }, out: vec4f })
      .does(/* wgsl */ `(input: Input) -> @location(0) vec4f {
        let xz_dist = length(input.originRelToCamera.xz);
        if (xz_dist < 1) {
          discard;
        }
        return computeColor();
      }`)
      .$uses({ computeColor });

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
