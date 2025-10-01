import { type v3f, vec2f } from 'typegpu/data';
import { cross, normalize } from 'typegpu/std';

import { type MeshAsset, meshAsset } from '../asset/mesh-asset.ts';

export interface RectangleProps {
  width: v3f;
  height: v3f;
}

/**
 * Creates a rectangle mesh whose normal vector is perpendicular to both `width` and `height`.
 * The width of the rectangle equals the magnitude of `wSpan`, and the height of the rectangle
 * equals the magnitude of `height`.
 */
export function createRectangleMesh({
  width,
  height,
}: RectangleProps): MeshAsset {
  const halfWidth = width.mul(0.5);
  const halfHeight = height.mul(0.5);
  const negHalfWidth = width.mul(-0.5);
  const negHalfHeight = height.mul(-0.5);

  const normal = normalize(cross(width, height));

  return meshAsset({
    data: {
      vertices: [
        {
          // (-1, -1, 0)
          pos: negHalfWidth.add(negHalfHeight),
          normal,
          uv: vec2f(0, 0),
        },
        {
          // (1, -1, 0)
          pos: halfWidth.add(negHalfHeight),
          normal,
          uv: vec2f(1, 0),
        },
        {
          // (1, 1, 0),
          pos: halfWidth.add(halfHeight),
          normal,
          uv: vec2f(1, 1),
        },
        // Second triangle
        {
          // (-1, -1, 0)
          pos: negHalfWidth.add(negHalfHeight),
          normal,
          uv: vec2f(0, 0),
        },
        {
          // (1, 1, 0),
          pos: halfWidth.add(halfHeight),
          normal,
          uv: vec2f(1, 1),
        },
        {
          // (-1, 1, 0),
          pos: negHalfWidth.add(halfHeight),
          normal,
          uv: vec2f(0, 1),
        },
      ],
    },
  });
}
