import { type TgpuBuffer, type VertexFlag, tgpu } from 'typegpu';
import {
  type Disarray,
  type WgslArray,
  disarrayOf,
  unstruct,
  vec2f,
  vec3f,
} from 'typegpu/data';

export interface Mesh {
  vertexCount: number;
  vertexBuffer: TgpuBuffer<WgslArray | Disarray> & VertexFlag;
}

export const POS_NORMAL_UV = tgpu.vertexLayout((n) =>
  disarrayOf(unstruct({ pos: vec3f, normal: vec3f, uv: vec2f }), n),
);
