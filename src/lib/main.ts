import { createWorld, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import tgpu from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';

import susannePath from '../assets/susanne.obj?url';
import { loadModel } from './assets.ts';
import { type Mesh, Renderer } from './renderer/renderer.ts';

const Player = trait();
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

  const susanne = await loadModel(root, susannePath);
  const player = world.spawn(
    Player,
    MeshTrait(susanne),
    TransformTrait({ position: vec3f(0, 0, -5) }),
  );

  let lastTime = Date.now();
  const handleFrame = () => {
    const now = Date.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    world
      .query(TransformTrait, Velocity)
      .updateEach(([transform, velocity]) => {
        transform.position.x += velocity.x * delta;
        transform.position.y += velocity.y * delta;
        transform.position.z += velocity.z * delta;
      });

    // Render system
    world.query(MeshTrait, TransformTrait).updateEach(([mesh, transform]) => {
      renderer.addObject(mesh, transform);
    });

    world.query(TransformTrait, Player).updateEach(([transform]) => {
      // Rotating the player
      quat.rotateY(transform.rotation, delta, transform.rotation);
    });

    renderer.render();
    requestAnimationFrame(handleFrame);
  };

  handleFrame();
}
