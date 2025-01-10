import {
  encroach,
  ActiveCameraTag,
  Time,
  Engine,
  getOrThrow,
  MeshTrait,
  PerspectiveCamera,
  TransformTrait,
  Input,
  meshAsset,
  Renderer,
  BlinnPhongMaterial,
} from 'wayfare';
import { type World, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { length, normalize } from 'typegpu/std';
import { quat } from 'wgpu-matrix';

import dudePath from '../assets/dude.obj?url';
import { MapProgressMarker, createMap } from './map';
import { createAirParticles } from './air-particles';

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

// Preloading...
const loadingScreen = document.getElementById('loading-screen');

const dudeMesh = await meshAsset({ url: dudePath }).preload();
const { updateMapSystem } = await createMap();

if (loadingScreen) {
  loadingScreen.style.display = 'none';
}

function controlPlayerSystem(world: World) {
  const deltaSeconds = getOrThrow(world, Time).deltaSeconds;

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
    dude.movementDir.x = dir.x;
    dude.movementDir.y = dir.y;
    dude.movementDir.z = dir.z;
  });
}

function updateDudeVelocitySystem(world: World) {
  const deltaSeconds = getOrThrow(world, Time).deltaSeconds;

  world.query(Dude, Velocity).updateEach(([dude, velocity]) => {
    const dir = dude.movementDir;
    const speed = dude.freeFallHorizontalSpeed;
    // Encroaching the movement direction
    velocity.x = encroach(velocity.x, dir.x * speed, 0.1, deltaSeconds);
    velocity.z = encroach(velocity.z, dir.z * speed, 0.1, deltaSeconds);
  });
}

function animateDudeSystem(world: World) {
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

function followCameraSystem(world: World) {
  const deltaSeconds = getOrThrow(world, Time).deltaSeconds;
  const player = world.queryFirst(Player);
  if (!player) return;

  const playerPos = getOrThrow(player, TransformTrait).position;

  world.query(TransformTrait, GameCameraTag).updateEach(([cameraTransform]) => {
    const pos = cameraTransform.position;
    pos.x = encroach(pos.x, playerPos.x, 0.0001, deltaSeconds);
    pos.y = playerPos.y + 0.7;
    pos.z = encroach(pos.z, playerPos.z, 0.0001, deltaSeconds);
  });
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);

  const engine = new Engine(root, renderer);
  const world = engine.world;

  const AirParticles = await createAirParticles(root);

  world.spawn(
    Player,
    Dude,
    MapProgressMarker,
    MeshTrait(dudeMesh),
    TransformTrait({
      position: vec3f(0, 0, 0),
      scale: vec3f(0.1),
    }),
    ...BlinnPhongMaterial.Bundle({ albedo: vec3f(1, 1, 1) }),
    Velocity(vec3f(0, -5, 0)),
  );

  const gameCamera = world.spawn(
    GameCameraTag,
    ActiveCameraTag,
    PerspectiveCamera({ fov: 120, clearColor: [0.1, 0.6, 1, 1] }),
    TransformTrait({
      rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', vec4f()),
    }),
  );

  AirParticles.init(world);

  engine.run((deltaSeconds) => {
    // "Advancing by velocity" system
    world
      .query(TransformTrait, Velocity)
      .updateEach(([transform, velocity]) => {
        transform.position.x += velocity.x * deltaSeconds;
        transform.position.y += velocity.y * deltaSeconds;
        transform.position.z += velocity.z * deltaSeconds;
      });

    followCameraSystem(world);
    controlPlayerSystem(world);
    updateDudeVelocitySystem(world);
    animateDudeSystem(world);
    updateMapSystem(world);
    AirParticles.update(world);
  });
}
