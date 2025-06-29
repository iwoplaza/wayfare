import type { Render, TgpuRoot, TgpuTexture } from 'typegpu';

export class Viewport {
  private _depthTexture: (TgpuTexture & Render) | undefined;
  private _depthTextureView: GPUTextureView | undefined;

  constructor(
    private readonly _root: TgpuRoot,
    private _width: number,
    private _height: number,
  ) {}

  get width() {
    return this._width;
  }

  get height() {
    return this._height;
  }

  get depthTexture(): TgpuTexture & Render {
    if (!this._depthTexture) {
      this._depthTexture = this._root['~unstable']
        .createTexture({
          format: 'depth24plus',
          size: [this._width, this._height],
        })
        .$usage('render');
    }
    return this._depthTexture;
  }

  get depthTextureView(): GPUTextureView {
    if (!this._depthTextureView) {
      this._depthTextureView = this._root
        .unwrap(this.depthTexture)
        .createView();
    }
    return this._depthTextureView;
  }

  resize(width: number, height: number) {
    this._width = width;
    this._height = height;
    this._depthTexture = undefined;
    this._depthTextureView = undefined;
  }
}
