import { trait, type World } from 'koota';
import tgpu, { d, std, type TgpuRoot } from 'typegpu';
import { vec2f, vec3f, vec4f } from 'typegpu/data';
import * as wf from 'wayfare';
import { playerSize, type DashDirection, type PlayerSnapshot } from './physics.ts';

const particleAmount = 192;
const particlesPerDash = 58;
const particleDepth = 0.08;
const DashParticleSystem = trait();

const DashParticleInstance = d.unstruct({
  center: d.vec2f,
  direction: d.vec2f,
  color: d.vec4f,
  shape: d.vec4f,
});

const DashParticleInstanceLayout = tgpu.vertexLayout(
  d.disarrayOf(DashParticleInstance),
  'instance',
);

const particleMesh = wf.createRectangleMesh({
  width: vec3f(1, 0, 0),
  height: vec3f(0, 1, 0),
});

const DashParticlesMaterial = wf.createMaterial({
  vertexLayout: wf.POS_NORMAL_UV,
  instanceLayout: DashParticleInstanceLayout,

  createPipeline({ root, format, $$ }) {
    const Varying = {
      uv: d.vec2f,
      color: d.vec4f,
      alpha: d.f32,
    } as const;

    const vertexFn = tgpu.vertexFn({
      in: {
        pos: d.vec3f,
        normal: d.vec3f,
        uv: d.vec2f,
        center: d.vec2f,
        direction: d.vec2f,
        color: d.vec4f,
        shape: d.vec4f,
      },
      out: {
        pos: d.builtin.position,
        ...Varying,
      },
    })((input) => {
      'use gpu';
      const side = d.vec2f(-input.direction.y, input.direction.x);
      const local =
        input.direction * input.pos.x * input.shape.y + side * input.pos.y * input.shape.x;
      const world = input.center + local;

      return {
        pos: $$.viewProjMat * $$.modelMat * d.vec4f(world.x, world.y, particleDepth, 1),
        uv: input.uv,
        color: input.color,
        alpha: input.shape.z,
      };
    });

    const fragmentFn = tgpu.fragmentFn({
      in: Varying,
      out: d.vec4f,
    })((input) => {
      'use gpu';
      if (input.alpha < 0.01) {
        std.discard();
      }

      const horizontal = 1 - std.abs(input.uv.x * 2 - 1) * 0.38;
      const vertical = 1 - std.abs(input.uv.y * 2 - 1);
      const alpha = input.alpha * horizontal * vertical;
      if (alpha < 0.01) {
        std.discard();
      }

      return d.vec4f(input.color.rgb, alpha);
    });

    return {
      pipeline: root.createRenderPipeline({
        attribs: {
          ...wf.POS_NORMAL_UV.attrib,
          ...DashParticleInstanceLayout.attrib,
        },
        vertex: vertexFn,
        fragment: fragmentFn,
        targets: {
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
          depthWriteEnabled: false,
          depthCompare: 'less',
          format: 'depth24plus',
        },
      }),
    };
  },
});

type DashParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  thickness: number;
  length: number;
};

type DashParticleInstanceValue = {
  center: ReturnType<typeof vec2f>;
  direction: ReturnType<typeof vec2f>;
  color: ReturnType<typeof vec4f>;
  shape: ReturnType<typeof vec4f>;
};

export function createDashParticles(world: World, root: TgpuRoot) {
  const particles = Array.from({ length: particleAmount }, createInactiveParticle);
  const instances = Array.from({ length: particleAmount }, createInactiveInstance);
  const instanceBuffer = root
    .createBuffer(DashParticleInstanceLayout.schemaForCount(particleAmount), instances)
    .$usage('vertex');
  let cursor = 0;
  let hueSeed = 0;

  world.spawn(
    DashParticleSystem,
    wf.TransformTrait,
    wf.MeshTrait(particleMesh),
    wf.InstanceBufferTrait(instanceBuffer),
    ...DashParticlesMaterial.Bundle(),
  );

  return {
    emit(player: PlayerSnapshot, dashDirection: Exclude<DashDirection, 0>) {
      const exhaustDirection = -dashDirection;
      const emitterX = player.x - dashDirection * playerSize.width * 0.52;
      hueSeed = (hueSeed + 0.19) % 1;

      for (let i = 0; i < particlesPerDash; i++) {
        const particle = particles[cursor];
        const instance = instances[cursor];
        const scatter = Math.random() * 2 - 1;
        const speed = 4.4 + Math.random() * 3.1;
        const xVelocity = exhaustDirection * speed;
        const hue = (hueSeed + i / particlesPerDash + Math.random() * 0.09) % 1;

        particle.x = emitterX + (Math.random() * 0.18 - 0.09);
        particle.y = player.y + scatter * playerSize.height * 0.58;
        particle.vx = xVelocity;
        particle.vy = 0;
        particle.age = 0;
        particle.lifetime = 0.24 + Math.random() * 0.22;
        particle.thickness = 0.055 + Math.random() * 0.055;
        particle.length = 0.42 + Math.random() * 0.38;

        instance.direction.x = exhaustDirection;
        instance.direction.y = 0;
        setHueColor(instance.color, hue);
        syncInstance(particle, instance);

        cursor = (cursor + 1) % particleAmount;
      }

      instanceBuffer.write(instances);
    },

    update(deltaSeconds: number) {
      let hasActiveParticle = false;

      for (let i = 0; i < particleAmount; i++) {
        const particle = particles[i];
        const instance = instances[i];
        if (particle.age >= particle.lifetime) {
          instance.shape.z = 0;
          continue;
        }

        particle.age += deltaSeconds;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.vx *= 1 - Math.min(0.88, deltaSeconds * 2.2);
        particle.vy *= 1 - Math.min(0.82, deltaSeconds * 1.8);
        syncInstance(particle, instance);
        hasActiveParticle = true;
      }

      if (hasActiveParticle) {
        instanceBuffer.write(instances);
      }
    },
  };
}

function createInactiveParticle(): DashParticle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 1,
    lifetime: 1,
    thickness: 0,
    length: 0,
  };
}

function createInactiveInstance(): DashParticleInstanceValue {
  return {
    center: vec2f(),
    direction: vec2f(1, 0),
    color: vec4f(),
    shape: vec4f(),
  };
}

function syncInstance(particle: DashParticle, instance: DashParticleInstanceValue) {
  const progress = Math.min(1, particle.age / particle.lifetime);
  const fade = (1 - progress) * (1 - progress);

  instance.center.x = particle.x;
  instance.center.y = particle.y;
  instance.shape.x = particle.thickness * (0.74 + fade * 0.26);
  instance.shape.y = particle.length * (0.34 + fade * 0.66);
  instance.shape.z = fade;
  instance.shape.w = 0;
}

function setHueColor(color: ReturnType<typeof vec4f>, hue: number) {
  const r = hueChannel(hue + 1 / 3);
  const g = hueChannel(hue);
  const b = hueChannel(hue - 1 / 3);

  color.x = 0.28 + r * 0.72;
  color.y = 0.28 + g * 0.72;
  color.z = 0.28 + b * 0.72;
  color.w = 1;
}

function hueChannel(value: number) {
  const wrapped = ((value % 1) + 1) % 1;
  return Math.max(0, Math.min(1, Math.abs(wrapped * 6 - 3) - 1));
}
