import tgpu, { type ExperimentalTgpuRoot } from 'typegpu/experimental';
import { vec2f, vec3f } from 'typegpu/data';
import { load, type DataType, type Loader } from '@loaders.gl/core';
import { OBJLoader } from '@loaders.gl/obj';

import susannePath from '../assets/susanne.obj?url';
import { Renderer, vertexLayout } from './renderer/renderer.ts';

export async function loadModel(
  root: ExperimentalTgpuRoot,
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

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();

  const renderer = new Renderer(root, canvas);

  renderer.addModel(await loadModel(root, susannePath, OBJLoader));

  renderer.loop();
}
