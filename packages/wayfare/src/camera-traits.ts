import { type Trait, trait } from 'koota';

export type PerspectiveConfig = {
  fov: number;
  near: number;
  far: number;
  clearColor?: [number, number, number, number];
};

// biome-ignore lint/complexity/noBannedTypes: <koota likes them>
type ActiveCameraTag = Trait<{}>;

type PerspectiveCamera = Trait<{
  fov: number;
  near: number;
  far: number;
  clearColor: [number, number, number, number];
}>;

export const ActiveCameraTag: ActiveCameraTag = trait();
export const PerspectiveCamera: PerspectiveCamera = trait({
  fov: 45,
  near: 0.02,
  far: 1000,
  clearColor: [0, 0, 0, 1] as [number, number, number, number],
});
