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

import dudeFile from './assets/dude.js';

const dudeMesh = meshAsset({ src: dudeFile });

export const Dude = trait({
  freeFallHorizontalSpeed: 2,
  movementDir: () => vec3f(),
  smoothTurnDir: () => vec3f(),
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
      // Smoothly encroaching the velocity
      velocity.x = encroach(velocity.x, dir.x * speed, 0.1, deltaSeconds);
      velocity.z = encroach(velocity.z, dir.z * speed, 0.1, deltaSeconds);
    });
  }

  function animateDudeSystem() {
    const deltaSeconds = getOrThrow(world, Time).deltaSeconds;

    world.query(TransformTrait, Dude).updateEach(([transform, dude]) => {
      const dir = dude.movementDir;
      // Smoothly encroaching the turn direction
      dude.smoothTurnDir.x = encroach(
        dude.smoothTurnDir.x,
        dir.x,
        0.01,
        deltaSeconds,
      );
      dude.smoothTurnDir.z = encroach(
        dude.smoothTurnDir.z,
        dir.z,
        0.01,
        deltaSeconds,
      );

      // Tilting based on movement direction
      transform.rotation = quat.fromEuler(
        dude.smoothTurnDir.z * Math.PI * 0.2,
        0,
        dude.smoothTurnDir.x * -Math.PI * 0.2,
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
