import { trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';

import susannePath from '../assets/susanne.obj?url';
import pentagonPath from '../assets/pentagon.obj?url';
import { loadModel } from './assets.ts';
import { Renderer } from './renderer/renderer.ts';
import { Engine, MeshTrait, TransformTrait } from './engine.ts';
import { MainCameraTag, PerspectiveCamera } from './camera-traits.ts';

const Velocity = trait(() => vec3f());
const Player = trait();

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

    // "Rotating the player" system
    engine.world
      .query(TransformTrait, Player)
      .updateEach(([transform], entity) => {
        console.log(`Rotating entity ${entity.id()}`);
        quat.rotateY(transform.rotation, deltaSeconds, transform.rotation);
      });
  });

  engine.world.spawn(
    Player,
    MeshTrait(susanne),
    TransformTrait({
      position: vec3f(0, 0, 0),
      scale: vec3f(0.1),
    }),
  );

  engine.world.spawn(
    MeshTrait(pentagon),
    TransformTrait({
      position: vec3f(0, -1, 0),
    }),
    Velocity(vec3f(0, 1, 0)),
  );

  engine.world.spawn(
    MainCameraTag,
    PerspectiveCamera,
    TransformTrait({
      position: vec3f(0, 5, 0),
      rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', vec4f()),
    }),
    Velocity(vec3f(0, 0, 0)),
  );

  engine.run();
}
