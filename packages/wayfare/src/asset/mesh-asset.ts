import { type DataType, type Loader, load, parse } from '@loaders.gl/core';
import type { Mesh as LoadersMesh } from '@loaders.gl/schema';
import { OBJLoader } from '@loaders.gl/obj';
import { type v2f, type v3f, vec2f, vec3f } from 'typegpu/data';
import type { TgpuRoot } from 'typegpu';

import { type Mesh, POS_NORMAL_UV } from '../mesh.js';

export type MeshAssetOptions = {
  url?: string | undefined;
  src?: string | DataType | undefined;
  data?: MeshData | undefined;
};

export type MeshAsset = {
  preload(): Promise<MeshAsset>;
  get(root: TgpuRoot): Promise<Mesh> | Mesh;
  peek(root: TgpuRoot): Mesh | undefined;
};

export const meshAsset = ({
  url,
  src,
  data: preexistingData,
}: MeshAssetOptions): MeshAsset => {
  let meshDataPromise: Promise<MeshData> | null = null;
  let meshData: MeshData | undefined = preexistingData;

  const meshPromiseStore = new WeakMap<TgpuRoot, Promise<Mesh>>();
  const meshStore = new WeakMap<TgpuRoot, Mesh>();

  return {
    async preload(): Promise<MeshAsset> {
      if (meshData) {
        return this;
      }

      if (!meshDataPromise) {
        if (url) {
          meshDataPromise = load(url, OBJLoader)
            .then(transformObjModel)
            .then((data) => {
              meshData = data;
              return data;
            });
        } else if (src) {
          meshDataPromise = parse(src, OBJLoader)
            .then(transformObjModel)
            .then((data) => {
              meshData = data;
              return data;
            });
        } else {
          throw new Error(
            `Invalid mesh asset parameters. Expected either 'src' or 'url'`,
          );
        }
      }

      meshData = await meshDataPromise;
      return this;
    },

    get(root: TgpuRoot): Promise<Mesh> | Mesh {
      let mesh = meshStore.get(root);
      // The mesh has already been created for this root
      if (mesh) {
        return mesh;
      }

      let meshPromise = meshPromiseStore.get(root);
      // The mesh is being loaded, return the existing promise.
      if (meshPromise) {
        return meshPromise;
      }

      meshPromise = (async () => {
        await this.preload();

        mesh = await createMeshFromData(root, meshData as MeshData);
        meshStore.set(root, mesh);
        return mesh;
      })();
      meshPromiseStore.set(root, meshPromise);

      return meshPromise;
    },

    peek(root: TgpuRoot): Mesh | undefined {
      const value = this.get(root);
      if (value instanceof Promise) {
        return undefined;
      }
      return value;
    },
  };
};

type MeshData = {
  vertices: { pos: v3f; normal: v3f; uv: v2f }[];
};

async function loadModel(
  src: string | DataType,
  loader: Loader = OBJLoader,
): Promise<MeshData> {
  const rawData = await load(src, loader);

  const POSITION = rawData.attributes.POSITION.value;
  const NORMAL = rawData.attributes.NORMAL.value;
  const TEXCOORD_0 = rawData.attributes.TEXCOORD_0.value;
  const vertexCount = POSITION.length / 3;

  return {
    vertices: Array.from({ length: vertexCount }, (_, i) => ({
      pos: vec3f(POSITION[i * 3], POSITION[i * 3 + 1], POSITION[i * 3 + 2]),
      normal: vec3f(NORMAL[i * 3], NORMAL[i * 3 + 1], NORMAL[i * 3 + 2]),
      uv: vec2f(TEXCOORD_0[i * 2], TEXCOORD_0[i * 2 + 1]),
    })),
  };
}

async function transformObjModel(rawData: LoadersMesh): Promise<MeshData> {
  const POSITION = rawData.attributes.POSITION.value;
  const NORMAL = rawData.attributes.NORMAL.value;
  const TEXCOORD_0 = rawData.attributes.TEXCOORD_0.value;
  const vertexCount = POSITION.length / 3;

  return {
    vertices: Array.from({ length: vertexCount }, (_, i) => ({
      pos: vec3f(POSITION[i * 3], POSITION[i * 3 + 1], POSITION[i * 3 + 2]),
      normal: vec3f(NORMAL[i * 3], NORMAL[i * 3 + 1], NORMAL[i * 3 + 2]),
      uv: vec2f(TEXCOORD_0[i * 2], TEXCOORD_0[i * 2 + 1]),
    })),
  };
}

function createMeshFromData(root: TgpuRoot, data: MeshData): Mesh {
  const vertexCount = data.vertices.length;

  const vertexBuffer = root
    .createBuffer(POS_NORMAL_UV.schemaForCount(vertexCount), data.vertices)
    .$usage('vertex');

  return { vertexCount, vertexBuffer };
}
