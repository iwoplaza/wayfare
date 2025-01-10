import { meshAsset, type MeshAsset } from 'wayfare/assets';
import { vec2f, type v3f } from 'typegpu/data';
import { add, cross, mul, normalize } from 'typegpu/std';

export interface RectangleProps {
  width: v3f;
  height: v3f;
}

/**
 * Creates a rectangle mesh whose normal vector is perpendicular to both `width` and `height`.
 * The width of the rectangle equals the magnitude of `wSpan`, and the height of the rectangle
 * equals the magnitude of `height`.
 */
export function createRectangle({ width, height }: RectangleProps): MeshAsset {
  const halfWidth = mul(0.5, width);
  const halfHeight = mul(0.5, height);

  const negHalfWidth = mul(-0.5, width);
  const negHalfHeight = mul(-0.5, height);

  const normal = normalize(cross(width, height));

  return meshAsset({
    data: {
      vertices: [
        {
          // (-1, -1, 0)
          pos: add(negHalfWidth, negHalfHeight),
          normal,
          uv: vec2f(0, 0),
        },
        {
          // (1, -1, 0)
          pos: add(halfWidth, negHalfHeight),
          normal,
          uv: vec2f(1, 0),
        },
        {
          // (1, 1, 0),
          pos: add(halfWidth, halfHeight),
          normal,
          uv: vec2f(1, 1),
        },
        // Second triangle
        {
          // (-1, -1, 0)
          pos: add(negHalfWidth, negHalfHeight),
          normal,
          uv: vec2f(0, 0),
        },
        {
          // (1, 1, 0),
          pos: add(halfWidth, halfHeight),
          normal,
          uv: vec2f(1, 1),
        },
        {
          // (-1, 1, 0),
          pos: add(negHalfWidth, halfHeight),
          normal,
          uv: vec2f(0, 1),
        },
      ],
    },
  });
}
