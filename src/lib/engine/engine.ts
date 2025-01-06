import {
  type Entity,
  Not,
  type Trait,
  createAdded,
  createRemoved,
  createWorld,
  trait,
} from 'koota';
import { mat4x4f, vec3f, vec4f } from 'typegpu/data';
import type { ExperimentalTgpuRoot } from 'typegpu/experimental';
import { mat4, quat } from 'wgpu-matrix';

import type { MeshAsset } from './assets.ts';
import { ActiveCameraTag, PerspectiveCamera } from './camera-traits.ts';
import { ChildOf, ParentOf } from './node-tree.ts';
import type { Renderer } from './renderer/renderer.ts';
import { Time } from './time.ts';
import { BlinnPhongMaterial } from './renderer/blinn-phong-material.ts';
import { MaterialTrait, type Material } from './renderer/material.ts';
import { getOrAdd, getOrThrow } from './get-or-add.ts';

const Added = createAdded();
const Removed = createRemoved();

export const MeshTrait = trait(() => ({}) as MeshAsset);
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

const DefaultMaterial = BlinnPhongMaterial.material;

export class Engine {
  public readonly world = createWorld();

  constructor(
    public readonly root: ExperimentalTgpuRoot,
    public readonly renderer: Renderer,
  ) {
    this.world.add(Time);
  }

  run(onFrame: (deltaSeconds: number) => unknown) {
    let lastTime = Date.now();
    const handleFrame = () => {
      const now = Date.now();
      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;

      this.world.set(Time, { deltaSeconds });

      onFrame(deltaSeconds);

      // "Updating matrices based on transforms" system
      const updateMatrices = (entity: Entity) => {
        const transform = getOrThrow(entity, TransformTrait);
        const matrices = getOrAdd(entity, MatricesTrait);

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
          const parentWorld = getOrThrow(parent, MatricesTrait).world;
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
      this.world.query(Added(MeshTrait)).updateEach(([meshAsset], entity) => {
        if (!entity.has(TransformTrait)) {
          throw new Error('Entities with meshes require a TransformTrait');
        }

        const matrices = getOrThrow(entity, MatricesTrait);

        let material: Material = DefaultMaterial;
        const materialTrait = entity.get(MaterialTrait);
        if (materialTrait) {
          material = materialTrait.material;
        }

        this.renderer.addObject({
          id: entity.id(),
          meshAsset,
          worldMatrix: matrices.world,
          material,
          get materialParams() {
            return materialTrait
              ? entity.get(materialTrait.paramsTrait as unknown as Trait)
              : DefaultMaterial.paramsDefaults;
          },
        });
      });

      // "Removing objects from the renderer" system
      this.world.query(Removed(MeshTrait)).updateEach((_, entity) => {
        this.renderer.removeObject(entity.id());
      });

      // "Updating the point-of-view based on the main camera" system
      const activeCam = this.world.queryFirst(ActiveCameraTag);
      if (activeCam) {
        const transform = getOrThrow(activeCam, TransformTrait);
        if (activeCam.has(PerspectiveCamera)) {
          this.renderer.setPerspectivePOV(
            transform,
            getOrThrow(activeCam, PerspectiveCamera),
          );
        }
      }

      this.renderer.render();
      requestAnimationFrame(handleFrame);
    };

    handleFrame();
  }
}
