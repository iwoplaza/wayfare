import {
  mat4x4f,
  struct,
  type AnyWgslData,
  type Infer,
  type m4x4f,
  type Vec4f,
  type Normal,
  type BaseWgslData,
} from 'typegpu/data';
import {
  type ExperimentalTgpuRoot as TgpuRoot,
  type TgpuRenderPipeline,
  tgpu,
  type TgpuBindGroup,
  type TgpuBindGroupLayout,
} from 'typegpu/experimental';

export interface MaterialContext<TParams> {
  readonly root: TgpuRoot;
  readonly format: GPUTextureFormat;
  getPOV(): {
    value: {
      viewProjMat: m4x4f;
    };
  };
  getUniforms(): {
    value: {
      modelMat: m4x4f;
      normalModelMat: m4x4f;
    };
  };
  getParams(): { value: Infer<TParams> };
}

export interface MaterialOptions {
  pipeline: TgpuRenderPipeline;
}

export interface Material<TParams extends BaseWgslData> {
  readonly instanceParamsSchema: TParams;
  readonly instanceParamsLayout: TgpuBindGroupLayout;
  readonly defaultParams: Infer<TParams>;
  getPipeline(
    root: TgpuRoot,
    format: GPUTextureFormat,
  ): TgpuRenderPipeline<Vec4f>;
}

export const UniformsStruct = struct({
  modelMat: mat4x4f,
  normalModelMat: mat4x4f,
});

export const POVStruct = struct({
  viewProjMat: mat4x4f,
});

export const sharedBindGroupLayout = tgpu.bindGroupLayout({
  pov: { uniform: POVStruct },
});

export const uniformsBindGroupLayout = tgpu.bindGroupLayout({
  uniforms: { uniform: UniformsStruct },
});

export type SharedBindGroup = TgpuBindGroup<
  (typeof sharedBindGroupLayout)['entries']
>;

export type UniformsBindGroup = TgpuBindGroup<
  (typeof uniformsBindGroupLayout)['entries']
>;

const { pov } = sharedBindGroupLayout.bound;
const { uniforms } = uniformsBindGroupLayout.bound;

export function createMaterial<TParams extends AnyWgslData>(
  instanceParamsSchema: TParams,
  defaultParams: Infer<Normal<TParams>>,
  maker: (ctx: MaterialContext<Normal<TParams>>) => MaterialOptions,
): Material<Normal<TParams>> {
  const pipelineStore = new WeakMap<TgpuRoot, TgpuRenderPipeline<Vec4f>>();

  const instanceParamsLayout = tgpu.bindGroupLayout({
    params: { uniform: instanceParamsSchema },
  }) as TgpuBindGroupLayout<{
    params: { uniform: Normal<TParams> };
  }>;

  return {
    instanceParamsSchema: instanceParamsSchema as Normal<TParams>,
    instanceParamsLayout,
    defaultParams,

    getPipeline(
      root: TgpuRoot,
      format: GPUTextureFormat,
    ): TgpuRenderPipeline<Vec4f> {
      const memo = pipelineStore.get(root);
      if (memo) {
        return memo;
      }

      const { pipeline } = maker({
        root,
        format,

        getParams(): { value: Infer<Normal<TParams>> } {
          return instanceParamsLayout.bound.params as {
            value: Infer<Normal<TParams>>;
          };
        },

        getPOV() {
          return pov;
        },

        getUniforms() {
          return uniforms;
        },
      });

      pipelineStore.set(root, pipeline);
      return pipeline;
    },
  };
}

export class MaterialInstance<TParams extends BaseWgslData = BaseWgslData> {
  constructor(
    public readonly material: Material<TParams>,
    private _params: Infer<TParams> = material.defaultParams,
  ) {}

  set params(params: Infer<TParams>) {
    this._params = params;
  }

  get params() {
    return this._params;
  }
}
