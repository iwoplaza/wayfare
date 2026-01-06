import type { RenderFlag, TgpuRoot, TgpuTexture } from 'typegpu';

export class Viewport {
  #depthTexture: (TgpuTexture & RenderFlag) | undefined;
  #depthTextureView: GPUTextureView | undefined;
  #root: TgpuRoot;
  #width: number;
  #height: number;

  constructor(root: TgpuRoot, width: number, height: number) {
    this.#root = root;
    this.#width = width;
    this.#height = height;
  }

  get width() {
    return this.#width;
  }

  get height() {
    return this.#height;
  }

  get depthTexture(): TgpuTexture & RenderFlag {
    if (!this.#depthTexture) {
      this.#depthTexture = this.#root['~unstable']
        .createTexture({
          format: 'depth24plus',
          size: [this.#width, this.#height],
        })
        .$usage('render');
    }
    return this.#depthTexture;
  }

  get depthTextureView(): GPUTextureView {
    if (!this.#depthTextureView) {
      this.#depthTextureView = this.#root
        .unwrap(this.depthTexture)
        .createView();
    }
    return this.#depthTextureView;
  }

  resize(width: number, height: number) {
    this.#width = width;
    this.#height = height;
    this.#depthTexture = undefined;
    this.#depthTextureView = undefined;
  }
}
