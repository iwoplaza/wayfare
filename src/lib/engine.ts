import {
  createAdded,
  createRemoved,
  createWorld,
  trait,
  type Entity,
} from 'koota';
import { mat4x4f, vec3f, vec4f } from 'typegpu/data';
import type { ExperimentalTgpuRoot } from 'typegpu/experimental';
import { mat4, quat } from 'wgpu-matrix';

import type { Renderer } from './renderer/renderer.ts';
import type { Mesh } from './mesh.ts';
import { MainCameraTag, PerspectiveCamera } from './camera-traits.ts';

const Added = createAdded();
const Removed = createRemoved();

export const MeshTrait = trait(() => ({}) as Mesh);
export const TransformTrait = trait({
  position: () => vec3f(),
  rotation: () => quat.identity(vec4f()),
  scale: () => vec3f(1),
});

/**
 * @internal
 */
export const MatricesTrait = trait(() => ({
  local: mat4x4f(),
  world: mat4x4f(),
}));

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

      // "Updating matrices based on transforms" system
      function updateMatrices(entity: Entity) {
        const transform = entity.get(TransformTrait);

        if (!entity.has(MatricesTrait)) {
          entity.add(MatricesTrait);
        }

        const matrices = entity.get(MatricesTrait);

        mat4.identity(matrices.local);
        mat4.scale(matrices.local, transform.scale, matrices.local);
        mat4.translate(matrices.local, transform.position, matrices.local);
        mat4.multiply(
          matrices.local,
          mat4.fromQuat(transform.rotation),
          matrices.local,
        );

        // TODO: Parent-child relationships
        mat4.copy(matrices.local, matrices.world);
      }

      this.world.query(TransformTrait).updateEach((_, entity) => {
        updateMatrices(entity);
      });

      // "Adding objects to the renderer" system
      this.world.query(Added(MeshTrait)).updateEach(([mesh], entity) => {
        if (!entity.has(TransformTrait)) {
          throw new Error('Entities with meshes require a TransformTrait');
        }

        this.renderer.addObject({
          id: entity.id(),
          mesh,
          worldMatrix: entity.get(MatricesTrait).world,
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
