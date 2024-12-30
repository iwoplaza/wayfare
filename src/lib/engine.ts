import { createWorld, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import type { ExperimentalTgpuRoot } from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';

import type { Mesh, Renderer } from './renderer/renderer.ts';

export const MeshTrait = trait(() => ({}) as Mesh);
export const TransformTrait = trait({
  position: vec3f(),
  rotation: quat.identity(vec4f()),
  scale: vec3f(1),
});

export class Engine {
  public readonly world = createWorld();

  constructor(
    public readonly root: ExperimentalTgpuRoot,
    public readonly renderer: Renderer,
    private readonly _onFrame: (deltaSeconds: number) => unknown,
  ) {}

  run() {
    let lastTime = Date.now();
    const handleFrame = () => {
      const now = Date.now();
      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;

      this._onFrame(deltaSeconds);

      // Render system
      this.world
        .query(MeshTrait, TransformTrait)
        .updateEach(([mesh, transform]) => {
          this.renderer.addObject(mesh, transform);
        });

      this.renderer.render();
      requestAnimationFrame(handleFrame);
    };

    handleFrame();
  }
}
