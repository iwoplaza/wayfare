import { tgpu, d } from 'typegpu';
import type { TgpuBuffer, VertexFlag } from 'typegpu';

export interface Mesh {
  vertexCount: number;
  vertexBuffer: TgpuBuffer<d.WgslArray | d.Disarray> & VertexFlag;
}

export const POS_NORMAL_UV = tgpu.vertexLayout(
  d.disarrayOf(d.unstruct({ pos: d.vec3f, normal: d.vec3f, uv: d.vec2f })),
);
