import { type DataType, type Loader, load } from '@loaders.gl/core';
import { OBJLoader } from '@loaders.gl/obj';
import { vec2f, vec3f } from 'typegpu/data';
import type { ExperimentalTgpuRoot as TgpuRoot } from 'typegpu/experimental';

import { type Mesh, vertexLayout } from './mesh.ts';

export type MeshAssetOptions = {
  url: string;
};

export type MeshAsset = {
  get(root: TgpuRoot): Promise<Mesh> | Mesh;
  peek(root: TgpuRoot): Mesh | undefined;
  readonly url: string;
};

export const meshAsset = ({ url }: MeshAssetOptions): MeshAsset => {
  const meshStore = new WeakMap<TgpuRoot, Mesh>();
  const meshPromiseStore = new WeakMap<TgpuRoot, Promise<Mesh>>();

  return {
    get(root: TgpuRoot): Promise<Mesh> | Mesh {
      const mesh = meshStore.get(root);
      if (mesh) {
        return mesh;
      }

      let meshPromise = meshPromiseStore.get(root);
      if (!meshPromise) {
        meshPromise = loadModel(root, url).then((model) => {
          meshStore.set(root, model);
          return model;
        });
        meshPromiseStore.set(root, meshPromise);
      }

      return meshPromise;
    },
    peek(root: TgpuRoot): Mesh | undefined {
      const value = this.get(root);
      if (value instanceof Promise) {
        return undefined;
      }
      return value;
    },
    url,
  };
};

async function loadModel(
  root: TgpuRoot,
  src: string | DataType,
  loader: Loader = OBJLoader,
) {
  const susanneModel = await load(src, loader);

  const POSITION = susanneModel.attributes.POSITION.value;
  const NORMAL = susanneModel.attributes.NORMAL.value;
  const TEXCOORD_0 = susanneModel.attributes.TEXCOORD_0.value;
  const vertexCount = POSITION.length / 3;

  const susanneVertexBuffer = root
    .createBuffer(
      vertexLayout.schemaForCount(vertexCount),
      Array.from({ length: vertexCount }, (_, i) => ({
        position: vec3f(
          POSITION[i * 3],
          POSITION[i * 3 + 1],
          POSITION[i * 3 + 2],
        ),
        normal: vec3f(NORMAL[i * 3], NORMAL[i * 3 + 1], NORMAL[i * 3 + 2]),
        uv: vec2f(TEXCOORD_0[i * 2], TEXCOORD_0[i * 2 + 1]),
      })),
    )
    .$usage('vertex');

  return { vertexCount, vertexBuffer: susanneVertexBuffer };
}
