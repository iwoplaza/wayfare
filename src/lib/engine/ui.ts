import { trait } from 'koota';
import { vec2f } from 'typegpu/data/index';

type XAnchor = 'left' | 'center' | 'right' | 'stretch';
type YAnchor = 'top' | 'center' | 'bottom' | 'stretch';

/**
 * Is stuck to the camera, rendered in an orthographic projection.
 */
export const UILayout = trait({
  xAnchor: 'left' as XAnchor,
  yAnchor: 'top' as YAnchor,
  offset: () => vec2f(),
  scale: () => vec2f(1),
});
