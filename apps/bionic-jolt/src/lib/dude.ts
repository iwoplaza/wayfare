/**
 * All code related to the character that the players embody.
 */

import { type ConfigurableTrait, type World, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import {
  BlinnPhongMaterial,
  MeshTrait,
  Time,
  TransformTrait,
  Velocity,
  encroach,
  getOrThrow,
  meshAsset,
} from 'wayfare';
import { quat } from 'wgpu-matrix';

import dudePath from '../assets/dude.obj?url';

const dudeMesh = await meshAsset({ url: dudePath }).preload();

export const Dude = trait({
  freeFallHorizontalSpeed: 2,
  movementDir: () => vec3f(),
});

export function DudeBundle(): ConfigurableTrait[] {
  return [
    Dude,
    MeshTrait(dudeMesh),
    ...BlinnPhongMaterial.Bundle({ albedo: vec3f(1, 1, 1) }),
  ];
}

export function createDudes(world: World) {
  function updateDudeVelocitySystem() {
    const deltaSeconds = getOrThrow(world, Time).deltaSeconds;

    world.query(Dude, Velocity).updateEach(([dude, velocity]) => {
      const dir = dude.movementDir;
      const speed = dude.freeFallHorizontalSpeed;
      // Smoothly encroaching the movement direction
      velocity.x = encroach(velocity.x, dir.x * speed, 0.1, deltaSeconds);
      velocity.z = encroach(velocity.z, dir.z * speed, 0.1, deltaSeconds);
    });
  }

  function animateDudeSystem() {
    world
      .query(Velocity, TransformTrait, Dude)
      .updateEach(([velocity, transform]) => {
        // Tilting based on movement direction
        transform.rotation = quat.fromEuler(
          velocity.z * Math.PI * 0.1,
          0,
          velocity.x * -Math.PI * 0.1,
          'xyz',
          vec4f(),
        );
      });
  }

  return {
    update() {
      updateDudeVelocitySystem();
      animateDudeSystem();
    },
  };
}
