import * as d from 'typegpu/data';
import { normalize } from 'typegpu/std';
import { type MeshAsset, meshAsset } from './mesh-asset.ts';

type MeshData = {
  vertices: { pos: d.v3f; normal: d.v3f; uv: d.v2f }[];
};

function appendFace(data: MeshData, fwd: d.v3f, right: d.v3f, up: d.v3f) {
  const normal = normalize(fwd);
  data.vertices.push({ pos: fwd.add(right).add(up), normal, uv: d.vec2f() });
  data.vertices.push({ pos: fwd.sub(right).sub(up), normal, uv: d.vec2f() });
  data.vertices.push({ pos: fwd.add(right).sub(up), normal, uv: d.vec2f() });

  data.vertices.push({ pos: fwd.sub(right).add(up), normal, uv: d.vec2f() });
  data.vertices.push({ pos: fwd.sub(right).sub(up), normal, uv: d.vec2f() });
  data.vertices.push({ pos: fwd.add(right).add(up), normal, uv: d.vec2f() });
}

export function createBoxMesh(width: number, height: number, depth: number): MeshAsset {
  const data = {
    vertices: [],
  };

  // X-
  appendFace(data, d.vec3f(-width, 0, 0), d.vec3f(0, height, 0), d.vec3f(0, 0, -depth));

  // X+
  appendFace(data, d.vec3f(width, 0, 0), d.vec3f(0, height, 0), d.vec3f(0, 0, depth));

  // Z-
  appendFace(data, d.vec3f(0, 0, -depth), d.vec3f(-width, 0, 0), d.vec3f(0, height, 0));

  // Z+
  appendFace(data, d.vec3f(0, 0, depth), d.vec3f(width, 0, 0), d.vec3f(0, height, 0));

  // Y-
  appendFace(data, d.vec3f(0, -height, 0), d.vec3f(width, 0, 0), d.vec3f(0, 0, depth));

  // Y+
  appendFace(data, d.vec3f(0, height, 0), d.vec3f(width, 0, 0), d.vec3f(0, 0, -depth));

  return meshAsset({ data });
}
