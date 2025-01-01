import {
  type Entity,
  Not,
  createAdded,
  createRemoved,
  createWorld,
  trait,
} from 'koota';
import { mat4x4f, vec3f, vec4f } from 'typegpu/data';
import type { ExperimentalTgpuRoot } from 'typegpu/experimental';
import { mat4, quat } from 'wgpu-matrix';

import { ActiveCameraTag, PerspectiveCamera } from './camera-traits.ts';
import type { Mesh } from './mesh.ts';
import { ChildOf, ParentOf } from './node-tree.ts';
import type { Renderer } from './renderer/renderer.ts';
import type { Material } from './renderer/shader.ts';

const Added = createAdded();
const Removed = createRemoved();

export const MeshTrait = trait(() => ({}) as Mesh);
export const TransformTrait = trait({
  position: () => vec3f(),
  rotation: () => quat.identity(vec4f()),
  scale: () => vec3f(1),
});

export const MaterialTrait = trait(() => ({}) as Material);

/**
 * @internal
 */
export const MatricesTrait = trait(() => ({
  local: mat4x4f(),
  world: mat4x4f(),
}));

const DefaultMaterial: Material = {
  albedo: vec3f(1, 0, 1),
};

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
      const updateMatrices = (entity: Entity) => {
        const transform = entity.get(TransformTrait);

        if (!entity.has(MatricesTrait)) {
          entity.add(MatricesTrait);
        }

        const matrices = entity.get(MatricesTrait);

        mat4.identity(matrices.local);
        mat4.translate(matrices.local, transform.position, matrices.local);
        mat4.scale(matrices.local, transform.scale, matrices.local);
        mat4.multiply(
          matrices.local,
          mat4.fromQuat(transform.rotation),
          matrices.local,
        );

        // Parent-child relationship
        const parent = this.world.queryFirst(ParentOf(entity));
        if (parent) {
          const parentWorld = parent.get(MatricesTrait).world;
          mat4.multiply(parentWorld, matrices.local, matrices.world);
        } else {
          mat4.copy(matrices.local, matrices.world);
        }

        // Update children
        this.world.query(ChildOf(entity)).updateEach((_, child) => {
          updateMatrices(child);
        });
      };

      this.world
        .query(TransformTrait, Not(ChildOf('*')))
        .updateEach((_, entity) => {
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
          material: entity.has(MaterialTrait)
            ? entity.get(MaterialTrait)
            : DefaultMaterial,
        });
      });

      // "Removing objects from the renderer" system
      this.world.query(Removed(MeshTrait)).updateEach((_, entity) => {
        this.renderer.removeObject(entity.id());
      });

      // "Updating the point-of-view based on the main camera" system
      const activeCam = this.world.queryFirst(ActiveCameraTag);
      if (activeCam) {
        const transform = activeCam.get(TransformTrait);
        if (activeCam.has(PerspectiveCamera)) {
          this.renderer.setPerspectivePOV(
            transform,
            activeCam.get(PerspectiveCamera),
          );
        }
      }

      this.renderer.render();
      requestAnimationFrame(handleFrame);
    };

    handleFrame();
  }
}
