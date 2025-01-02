import {
  ActiveCameraTag,
  ChildOf,
  Engine,
  MaterialTrait,
  MeshTrait,
  ParentOf,
  PerspectiveCamera,
  TransformTrait,
} from 'jolted';
import { Renderer } from 'jolted/renderer';
import { type Entity, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';
import { meshAsset } from 'jolted/assets';

import susannePath from '../assets/susanne.obj?url';
import { MapProgressMarker, updateMapSystem } from './map';

const Velocity = trait(() => vec3f());
const PlayerTag = trait();
const GameCameraTag = trait();

function connectAsChild(parent: Entity, child: Entity) {
  child.add(ChildOf(parent));
  parent.add(ParentOf(child));
}

const susanneMesh = meshAsset({ url: susannePath });

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);

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

    updateMapSystem(engine.world);
  });

  engine.world.spawn(
    PlayerTag,
    MapProgressMarker,
    MeshTrait(susanneMesh),
    TransformTrait({
      position: vec3f(0, 0, 0),
      scale: vec3f(0.1),
      rotation: quat.fromEuler(-Math.PI / 2, Math.PI, 0, 'xyz', vec4f()),
    }),
    MaterialTrait({ albedo: vec3f(1, 1, 1) }),
    Velocity(vec3f(0, -5, 0)),
  );

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
