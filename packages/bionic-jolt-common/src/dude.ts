/**
 * All code related to the character that the players embody.
 */

import { type ConfigurableTrait, type World, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import * as wf from 'wayfare';
import { quat } from 'wgpu-matrix';

import dudeFile from './assets/dude.ts';

const dudeMesh = wf.meshAsset({ src: dudeFile });

export const Dude = trait({
  freeFallHorizontalSpeed: 2,
  movementDir: () => vec3f(),
  smoothTurnDir: () => vec3f(),
});

export function DudeBundle(): ConfigurableTrait[] {
  return [
    Dude,
    wf.MeshTrait(dudeMesh),
    ...wf.BlinnPhongMaterial.Bundle({ albedo: vec3f(1, 1, 1) }),
  ];
}

export function createDudes(world: World) {
  function updateDudeVelocitySystem() {
    const deltaSeconds = wf.getOrThrow(world, wf.Time).deltaSeconds;

    world.query(Dude, wf.Velocity).updateEach(([dude, velocity]) => {
      const dir = dude.movementDir;
      const speed = dude.freeFallHorizontalSpeed;
      // Smoothly encroaching the velocity
      velocity.x = wf.encroach(velocity.x, dir.x * speed, 0.1, deltaSeconds);
      velocity.z = wf.encroach(velocity.z, dir.z * speed, 0.1, deltaSeconds);
    });
  }

  function animateDudeSystem() {
    const deltaSeconds = wf.getOrThrow(world, wf.Time).deltaSeconds;

    world.query(wf.TransformTrait, Dude).updateEach(([transform, dude]) => {
      const dir = dude.movementDir;
      // Smoothly encroaching the turn direction
      dude.smoothTurnDir.x = wf.encroach(
        dude.smoothTurnDir.x,
        dir.x,
        0.01,
        deltaSeconds,
      );
      dude.smoothTurnDir.z = wf.encroach(
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
