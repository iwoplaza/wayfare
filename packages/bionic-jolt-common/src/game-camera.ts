import { type World, trait } from 'koota';
import * as d from 'typegpu/data';
import * as wf from 'wayfare';
import { quat } from 'wgpu-matrix';
import { Player } from './player.js';

const GameCameraTag = trait();

export function createGameCamera(world: World) {
  world.spawn(
    GameCameraTag,
    wf.ActiveCameraTag,
    wf.PerspectiveCamera({ fov: 120, clearColor: [0.1, 0.6, 1, 1] }),
    wf.TransformTrait({
      rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', d.vec4f()),
    }),
  );

  function followPlayerSystem() {
    const deltaSeconds = wf.getOrThrow(world, wf.Time).deltaSeconds;
    const player = world.queryFirst(Player);

    if (!player) return;

    const playerPos = wf.getOrThrow(player, wf.TransformTrait).position;

    world
      .query(wf.TransformTrait, GameCameraTag)
      .updateEach(([cameraTransform]) => {
        const pos = cameraTransform.position;
        pos.x = wf.encroach(pos.x, playerPos.x, 0.0001, deltaSeconds);
        pos.y = playerPos.y + 0.7;
        pos.z = wf.encroach(pos.z, playerPos.z, 0.0001, deltaSeconds);
      });
  }

  return {
    update() {
      followPlayerSystem();
    },
  };
}
