import type { v3f, v4f } from 'typegpu/data';

export interface Transform {
  position: v3f;
  rotation: v4f;
  scale: v3f;
}
