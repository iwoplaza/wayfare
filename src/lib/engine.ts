import { createAdded, createRemoved, createWorld, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import type { ExperimentalTgpuRoot } from 'typegpu/experimental';
import { quat } from 'wgpu-matrix';

import type { Renderer } from './renderer/renderer.ts';
import type { Mesh } from './mesh.ts';
import { MainCameraTag, PerspectiveCamera } from './camera-traits.ts';

export const MeshTrait = trait(() => ({}) as Mesh);
export const TransformTrait = trait({
  position: () => vec3f(),
  rotation: () => quat.identity(vec4f()),
  scale: () => vec3f(1),
});

const Added = createAdded();
const Removed = createRemoved();

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

      // "Adding objects to the renderer" system
      this.world.query(Added(MeshTrait)).updateEach(([mesh], entity) => {
        if (!entity.has(TransformTrait)) {
          throw new Error('Entities with meshes require a TransformTrait');
        }

        this.renderer.addObject({
          id: entity.id(),
          mesh,
          transform: entity.get(TransformTrait),
        });
      });

      // "Removing objects from the renderer" system
      this.world.query(Removed(MeshTrait)).updateEach((_, entity) => {
        this.renderer.removeObject(entity.id());
      });

      // "Updating the point-of-view based on the main camera" system
      const mainCameraEntity = this.world.queryFirst(MainCameraTag);
      if (mainCameraEntity) {
        const transform = mainCameraEntity.get(TransformTrait);
        if (mainCameraEntity.has(PerspectiveCamera)) {
          this.renderer.setPerspectivePOV(
            transform,
            mainCameraEntity.get(PerspectiveCamera),
          );
        }
      }

      this.renderer.render();
      requestAnimationFrame(handleFrame);
    };

    handleFrame();
  }
}
