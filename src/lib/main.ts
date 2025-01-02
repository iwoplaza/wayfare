import {
  ActiveCameraTag,
  Engine,
  MaterialTrait,
  MeshTrait,
  PerspectiveCamera,
  TransformTrait,
} from 'jolted';
import { meshAsset } from 'jolted/assets';
import { Input } from 'jolted/input';
import { Renderer } from 'jolted/renderer';
import { type World, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { length, normalize } from 'typegpu/std';
import { quat } from 'wgpu-matrix';

import { encroach } from 'jolted/easing';
import { Time } from 'jolted/time';
import dudePath from '../assets/dude.obj?url';
import { MapProgressMarker, updateMapSystem } from './map';

const Velocity = trait(() => vec3f());

const Player = trait({
  upKey: 'KeyW',
  downKey: 'KeyS',
  leftKey: 'KeyA',
  rightKey: 'KeyD',
});

const Dude = trait({
  freeFallHorizontalSpeed: 2,
  movementDir: () => vec3f(),
});

const GameCameraTag = trait();

const dudeMesh = meshAsset({ url: dudePath });

function controlPlayerSystem(world: World) {
  const deltaSeconds = world.get(Time).deltaSeconds;

  world.query(Player, Dude).updateEach(([player, dude]) => {
    let dir = vec3f();

    if (Input.isKeyDown(player.upKey)) {
      dir.z = -1;
    } else if (Input.isKeyDown(player.downKey)) {
      dir.z = 1;
    } else {
      dir.z = 0;
    }

    if (Input.isKeyDown(player.leftKey)) {
      dir.x = -1;
    } else if (Input.isKeyDown(player.rightKey)) {
      dir.x = 1;
    } else {
      dir.x = 0;
    }

    if (length(dir) > 1) {
      dir = normalize(dir);
    }

    // Encroaching the movement direction
    dude.movementDir.x = encroach(dude.movementDir.x, dir.x, 0.1, deltaSeconds);
    dude.movementDir.y = encroach(dude.movementDir.y, dir.y, 0.1, deltaSeconds);
    dude.movementDir.z = encroach(dude.movementDir.z, dir.z, 0.1, deltaSeconds);
  });
}

function updateDudeVelocitySystem(world: World) {
  world.query(Dude, Velocity).updateEach(([dude, velocity]) => {
    velocity.x = dude.movementDir.x * dude.freeFallHorizontalSpeed;
    velocity.z = dude.movementDir.z * dude.freeFallHorizontalSpeed;
  });
}

function animatedDudeSystem(world: World) {
  world.query(Dude, TransformTrait).updateEach(([dude, transform]) => {
    // Tilting based on movement direction
    transform.rotation = quat.fromEuler(
      dude.movementDir.z * Math.PI * 0.2,
      0,
      dude.movementDir.x * -Math.PI * 0.2,
      'xyz',
      vec4f(),
    );
  });
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);

  const engine = new Engine(root, renderer);
  const world = engine.world;

  world.spawn(
    Player,
    Dude,
    MapProgressMarker,
    MeshTrait(dudeMesh),
    TransformTrait({
      position: vec3f(0, 0, 0),
      scale: vec3f(0.1),
    }),
    MaterialTrait({ albedo: vec3f(1, 1, 1) }),
    Velocity(vec3f(0, -5, 0)),
  );

  world.spawn(
    GameCameraTag,
    ActiveCameraTag,
    PerspectiveCamera({ fov: 120, clearColor: [0.1, 0.6, 1, 1] }),
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
        const player = world.queryFirst(Player);

        if (player) {
          const playerPos = player.get(TransformTrait).position;
          cameraTransform.position.x = playerPos.x;
          cameraTransform.position.y = playerPos.y + 0.7;
          cameraTransform.position.z = playerPos.z;
        }
      });

    controlPlayerSystem(world);
    updateDudeVelocitySystem(world);
    animatedDudeSystem(world);
    updateMapSystem(world);
  });
}
