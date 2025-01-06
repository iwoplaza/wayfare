import {
  looseArrayOf,
  looseStruct,
  vec2f,
  vec3f,
  type BaseWgslData,
  type LooseArray,
  type WgslArray,
} from 'typegpu/data';
import { type TgpuBuffer, type Vertex, tgpu } from 'typegpu/experimental';

export interface Mesh {
  vertexCount: number;
  vertexBuffer: TgpuBuffer<WgslArray<BaseWgslData> | LooseArray<BaseWgslData>> &
    Vertex;
}

export const POS_NORMAL_UV = tgpu.vertexLayout((n) =>
  looseArrayOf(looseStruct({ pos: vec3f, normal: vec3f, uv: vec2f }), n),
);
