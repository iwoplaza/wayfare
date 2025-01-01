import { trait, type Entity } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';

import susannePath from '../assets/susanne.obj?url';
import pentagonPath from '../assets/pentagon.obj?url';
import { loadModel } from './engine/assets.ts';
import { Renderer } from './renderer/renderer.ts';
import {
  Engine,
  MaterialTrait,
  MeshTrait,
  TransformTrait,
} from './engine/engine.ts';
import { ActiveCameraTag, PerspectiveCamera } from './engine/camera-traits.ts';
import { ChildOf, ParentOf } from './engine/node-tree.ts';

const Velocity = trait(() => vec3f());
const PlayerTag = trait();
const GameCameraTag = trait();
const LoopAround = trait();

function connectAsChild(parent: Entity, child: Entity) {
  child.add(ChildOf(parent));
  parent.add(ParentOf(child));
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);

  const susanne = await loadModel(root, susannePath);
  const pentagon = await loadModel(root, pentagonPath);

  const engine = new Engine(root, renderer, (deltaSeconds) => {
    // "Advancing by velocity" system
    engine.world
      .query(TransformTrait, Velocity)
      .updateEach(([transform, velocity]) => {
        transform.position.x += velocity.x * deltaSeconds;
        transform.position.y += velocity.y * deltaSeconds;
        transform.position.z += velocity.z * deltaSeconds;
      });

    // "Follow camera" system
    engine.world
      .query(TransformTrait, GameCameraTag)
      .updateEach(([cameraTransform]) => {
        const player = engine.world.queryFirst(PlayerTag);

        if (player) {
          const playerPos = player.get(TransformTrait).position;
          cameraTransform.position.x = playerPos.x;
          cameraTransform.position.y = playerPos.y + 5;
          cameraTransform.position.z = playerPos.z;
        }
      });

    // "Loop around" system
    engine.world.query(TransformTrait, LoopAround).updateEach(([transform]) => {
      const player = engine.world.queryFirst(PlayerTag);
      if (!player) return;

      // Is above the player?
      if (transform.position.y > player.get(TransformTrait).position.y + 5) {
        transform.position.y -= 40;
      }
    });
  });

  engine.world.spawn(
    PlayerTag,
    MeshTrait(susanne),
    TransformTrait({
      position: vec3f(0, 0, 0),
      scale: vec3f(0.1),
      rotation: quat.fromEuler(-Math.PI / 2, Math.PI, 0, 'xyz', vec4f()),
    }),
    MaterialTrait({ albedo: vec3f(1, 1, 1) }),
    Velocity(vec3f(0, -5, 0)),
  );

  for (let i = 0; i < 20; i++) {
    engine.world.spawn(
      MeshTrait(pentagon),
      TransformTrait({
        position: vec3f(0, -i * 2, 0),
        rotation: quat.fromEuler(0, (i / 20) * Math.PI * 2, 0, 'xyz', vec4f()),
      }),
      LoopAround,
      MaterialTrait({ albedo: vec3f(1, 0.5, 0) }),
    );
  }

  engine.world.spawn(
    GameCameraTag,
    ActiveCameraTag,
    PerspectiveCamera({ clearColor: [0.1, 0.6, 1, 1] }),
    TransformTrait({
      rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', vec4f()),
    }),
  );

  engine.run();
}
