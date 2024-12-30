import tgpu from 'typegpu/experimental';
import { OBJLoader } from '@loaders.gl/obj';
import { createWorld, trait } from 'koota';

import susannePath from '../assets/susanne.obj?url';
import { Renderer, type Mesh } from './renderer/renderer.ts';
import { loadModel } from './assets.ts';
import { vec3f, vec4f } from 'typegpu/data';
import { quat } from 'wgpu-matrix';

const Player = trait();
const Position = trait(() => vec3f());
const Velocity = trait(() => vec3f());
const MeshTrait = trait(() => ({}) as Mesh);
const TransformTrait = trait({
  position: vec3f(),
  rotation: quat.identity(vec4f()),
  scale: vec3f(1),
});

const world = createWorld();

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();

  const renderer = new Renderer(root, canvas);

  const susanne = await loadModel(root, susannePath, OBJLoader);
  const player = world.spawn(
    Player,
    MeshTrait(susanne),
    TransformTrait({ position: vec3f(0, 0, -3) }),
  );

  let lastTime = Date.now();
  const handleFrame = () => {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    // world.query(Position, Velocity).updateEach(([position, velocity]) => {
    //   position.x += velocity.x * delta;
    //   position.y += velocity.y * delta;
    // });

    world.query(MeshTrait, TransformTrait).updateEach(([mesh, transform]) => {
      renderer.addObject(mesh, transform);
    });

    renderer.render();
    requestAnimationFrame(handleFrame);
  };

  handleFrame();
}
