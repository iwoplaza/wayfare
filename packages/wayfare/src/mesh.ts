import {
  type Disarray,
  type WgslArray,
  disarrayOf,
  unstruct,
  vec2f,
  vec3f,
} from 'typegpu/data';
import { type TgpuBuffer, type Vertex, tgpu } from 'typegpu';

export interface Mesh {
  vertexCount: number;
  vertexBuffer: TgpuBuffer<WgslArray | Disarray> & Vertex;
}

export const POS_NORMAL_UV = tgpu['~unstable'].vertexLayout((n) =>
  disarrayOf(unstruct({ pos: vec3f, normal: vec3f, uv: vec2f }), n),
);
