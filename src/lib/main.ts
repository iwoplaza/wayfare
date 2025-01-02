import {
  ActiveCameraTag,
  Engine,
  MaterialTrait,
  MeshTrait,
  PerspectiveCamera,
  TransformTrait,
} from 'jolted';
import { meshAsset } from 'jolted/assets';
import { Renderer } from 'jolted/renderer';
import { Input } from 'jolted/input';
import { trait, type World } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';
import { length, normalize } from 'typegpu/std';

import susannePath from '../assets/susanne.obj?url';
import { MapProgressMarker, updateMapSystem } from './map';

const Velocity = trait(() => vec3f());
const PlayerTrait = trait({
  freeFallHorizontalSpeed: 1,
});
const GameCameraTag = trait();

const susanneMesh = meshAsset({ url: susannePath });

function controlPlayerSystem(world: World) {
  // "Control player" system
  const player = world.queryFirst(PlayerTrait);
  if (!player) return;

  const { freeFallHorizontalSpeed } = player.get(PlayerTrait);
  const velocity = player.get(Velocity);

  let dir = vec3f();

  if (Input.isKeyDown('KeyW')) {
    dir.z = -1;
  } else if (Input.isKeyDown('KeyS')) {
    dir.z = 1;
  } else {
    dir.z = 0;
  }

  if (Input.isKeyDown('KeyA')) {
    dir.x = -1;
  } else if (Input.isKeyDown('KeyD')) {
    dir.x = 1;
  } else {
    dir.x = 0;
  }

  if (length(dir) > 1) {
    dir = normalize(dir);
  }

  velocity.x = dir.x * freeFallHorizontalSpeed;
  velocity.z = dir.z * freeFallHorizontalSpeed;
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);

  const engine = new Engine(root, renderer);
  const world = engine.world;

  world.spawn(
    PlayerTrait,
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

  world.spawn(
    GameCameraTag,
    ActiveCameraTag,
    PerspectiveCamera({ clearColor: [0.1, 0.6, 1, 1] }),
    TransformTrait({
      rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', vec4f()),
    }),
  );

  engine.run((deltaSeconds) => {
    // "Advancing by velocity" system
    world
      .query(TransformTrait, Velocity)
      .updateEach(([transform, velocity]) => {
        transform.position.x += velocity.x * deltaSeconds;
        transform.position.y += velocity.y * deltaSeconds;
        transform.position.z += velocity.z * deltaSeconds;
      });

    // "Follow camera" system
    world
      .query(TransformTrait, GameCameraTag)
      .updateEach(([cameraTransform]) => {
        const player = world.queryFirst(PlayerTrait);

        if (player) {
          const playerPos = player.get(TransformTrait).position;
          cameraTransform.position.x = playerPos.x;
          cameraTransform.position.y = playerPos.y + 5;
          cameraTransform.position.z = playerPos.z;
        }
      });

    controlPlayerSystem(world);
    updateMapSystem(world);
  });
}
