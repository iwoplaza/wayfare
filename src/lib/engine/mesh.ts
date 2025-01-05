import { looseArrayOf, looseStruct, vec2f, vec3f } from 'typegpu/data';
import { type TgpuBuffer, type Vertex, tgpu } from 'typegpu/experimental';

export interface Mesh {
  vertexCount: number;
  vertexBuffer: TgpuBuffer<
    ReturnType<(typeof POS_NORMAL_UV)['schemaForCount']>
  > &
    Vertex;
}

export const POS_NORMAL_UV = tgpu.vertexLayout((n) =>
  looseArrayOf(looseStruct({ pos: vec3f, normal: vec3f, uv: vec2f }), n),
);
