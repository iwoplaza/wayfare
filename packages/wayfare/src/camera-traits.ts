import { type Trait, trait } from 'koota';

export type PerspectiveConfig = {
  fov: number;
  near: number;
  far: number;
  clearColor?: [number, number, number, number];
};

type ActiveCameraTag = Trait<Record<string, never>>;

type PerspectiveCamera = Trait<{
  fov: number;
  near: number;
  far: number;
  clearColor: () => [number, number, number, number];
}>;

// TODO: Remove assertion when new version of Koota comes out
export const ActiveCameraTag = trait() as unknown as ActiveCameraTag;
export const PerspectiveCamera: PerspectiveCamera = trait({
  fov: 45,
  near: 0.02,
  far: 1000,
  clearColor: () => [0, 0, 0, 1] as [number, number, number, number],
});
