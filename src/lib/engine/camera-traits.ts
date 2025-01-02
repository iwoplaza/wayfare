import { trait } from 'koota';

export type PerspectiveConfig = {
  fov: number;
  near: number;
  far: number;
  clearColor?: [number, number, number, number];
};

export const ActiveCameraTag = trait();
export const PerspectiveCamera = trait({
  fov: 45,
  near: 0.1,
  far: 1000,
  clearColor: [0, 0, 0, 1] as [number, number, number, number],
});
