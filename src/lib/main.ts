import { trait, type Entity } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';

import susannePath from '../assets/susanne.obj?url';
import pentagonPath from '../assets/pentagon.obj?url';
import { loadModel } from './assets.ts';
import { Renderer } from './renderer/renderer.ts';
import { Engine, MeshTrait, TransformTrait } from './engine.ts';
import { MainCameraTag, PerspectiveCamera } from './camera-traits.ts';
import { ChildOf, ParentOf } from './nodeTree.ts';

const Velocity = trait(() => vec3f());
const PlayerTag = trait();

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
  });

  const player = engine.world.spawn(
    PlayerTag,
    MeshTrait(susanne),
    TransformTrait({
      position: vec3f(0, 0, 0),
      scale: vec3f(0.1),
      rotation: quat.fromEuler(-Math.PI / 2, Math.PI, 0, 'xyz', vec4f()),
    }),
    Velocity(vec3f(0, 10, 0)),
  );

  engine.world.spawn(
    MeshTrait(pentagon),
    TransformTrait({
      position: vec3f(0, 0, 0),
    }),
  );

  connectAsChild(
    player,
    engine.world.spawn(
      MainCameraTag,
      PerspectiveCamera,
      TransformTrait({
        position: vec3f(0, 5, 0),
        rotation: quat.fromEuler(-Math.PI / 2, 0, 0, 'xyz', vec4f()),
      }),
      Velocity(vec3f(0, 0, 0)),
    ),
  );

  engine.run();
}
