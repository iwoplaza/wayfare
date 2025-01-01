import { trait } from 'koota';

export type PerspectiveConfig = {
  fov: number;
  near: number;
  far: number;
};

export const MainCameraTag = trait();
export const PerspectiveCamera = trait({
  fov: (75 / 180) * Math.PI,
  near: 0.1,
  far: 1000,
});
