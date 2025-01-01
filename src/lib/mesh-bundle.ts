import { tgpu, type Vertex, type TgpuBuffer } from 'typegpu/experimental';
import { looseArrayOf, looseStruct, vec2f, vec3f } from 'typegpu/data';
import type { Transform } from './transform';

export interface Mesh {
  vertexCount: number;
  vertexBuffer: TgpuBuffer<
    ReturnType<(typeof vertexLayout)['schemaForCount']>
  > &
    Vertex;
}

export interface MeshBundle {
  mesh: Mesh;
  transform: Transform;
}

export const vertexLayout = tgpu.vertexLayout((n) =>
  looseArrayOf(looseStruct({ position: vec3f, normal: vec3f, uv: vec2f }), n),
);
