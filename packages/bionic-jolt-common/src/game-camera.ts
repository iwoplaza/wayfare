import { type World, trait } from 'koota';
import { vec4f } from 'typegpu/data';
import {
  ActiveCameraTag,
  PerspectiveCamera,
  Time,
  TransformTrait,
  encroach,
  getOrThrow,
} from 'wayfare';
import { quat } from 'wgpu-matrix';
import { Player } from './player.js';

const GameCameraTag = trait();

export function createGameCamera(world: World) {
  world.spawn(
    GameCameraTag,
    ActiveCameraTag,
    PerspectiveCamera({ fov: 120, clearColor: [0.1, 0.6, 1, 1] }),
    TransformTrait({
      rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', vec4f()),
    }),
  );

  function followPlayerSystem() {
    const deltaSeconds = getOrThrow(world, Time).deltaSeconds;
    const player = world.queryFirst(Player);

    if (!player) return;

    const playerPos = getOrThrow(player, TransformTrait).position;

    world
      .query(TransformTrait, GameCameraTag)
      .updateEach(([cameraTransform]) => {
        const pos = cameraTransform.position;
        pos.x = encroach(pos.x, playerPos.x, 0.0001, deltaSeconds);
        pos.y = playerPos.y + 0.7;
        pos.z = encroach(pos.z, playerPos.z, 0.0001, deltaSeconds);
      });
  }

  return {
    update() {
      followPlayerSystem();
    },
  };
}
