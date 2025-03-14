import { type World, trait } from 'koota';
import * as d from 'typegpu/data';
import * as wayfare from 'wayfare';
import { quat } from 'wgpu-matrix';
import { Player } from './player.js';

const GameCameraTag = trait();

export function createGameCamera(world: World) {
  world.spawn(
    GameCameraTag,
    wayfare.ActiveCameraTag,
    wayfare.PerspectiveCamera({ fov: 120, clearColor: [0.1, 0.6, 1, 1] }),
    wayfare.TransformTrait({
      rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', d.vec4f()),
    }),
  );

  function followPlayerSystem() {
    const deltaSeconds = wayfare.getOrThrow(world, wayfare.Time).deltaSeconds;
    const player = world.queryFirst(Player);

    if (!player) return;

    const playerPos = wayfare.getOrThrow(
      player,
      wayfare.TransformTrait,
    ).position;

    world
      .query(wayfare.TransformTrait, GameCameraTag)
      .updateEach(([cameraTransform]) => {
        const pos = cameraTransform.position;
        pos.x = wayfare.encroach(pos.x, playerPos.x, 0.0001, deltaSeconds);
        pos.y = playerPos.y + 0.7;
        pos.z = wayfare.encroach(pos.z, playerPos.z, 0.0001, deltaSeconds);
      });
  }

  return {
    update() {
      followPlayerSystem();
    },
  };
}
