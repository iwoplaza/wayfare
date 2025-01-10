import {
  disarrayOf,
  unstruct,
  vec2f,
  vec3f,
  type Disarray,
  type WgslArray,
} from 'typegpu/data';
import { type TgpuBuffer, type Vertex, tgpu } from 'typegpu/experimental';

export interface Mesh {
  vertexCount: number;
  vertexBuffer: TgpuBuffer<WgslArray | Disarray> & Vertex;
}

export const POS_NORMAL_UV = tgpu.vertexLayout((n) =>
  disarrayOf(unstruct({ pos: vec3f, normal: vec3f, uv: vec2f }), n),
);
