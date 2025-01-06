import { trait, type ConfigurableTrait, type Schema, type Trait } from 'koota';
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
  type TgpuVertexLayout,
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

export interface Material<TParams extends BaseWgslData = BaseWgslData> {
  readonly paramsSchema: TParams | undefined;
  readonly paramsLayout: TgpuBindGroupLayout | undefined;
  readonly vertexLayout: TgpuVertexLayout;
  readonly paramsDefaults: Infer<TParams> | undefined;
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

type TraitFor<T> = T extends Schema ? Trait<T> : never;

export const MaterialTrait = trait({
  material: {} as Material,
  paramsTrait: {} as Trait,
});

export function createMaterial<TParams extends AnyWgslData>(
  options: {
    paramsSchema?: TParams;
    vertexLayout: TgpuVertexLayout;
    createPipeline: (ctx: MaterialContext<Normal<TParams>>) => MaterialOptions;
  } & (AnyWgslData extends TParams
    ? { paramsDefaults?: undefined }
    : { paramsDefaults: Infer<Normal<TParams>> }),
): {
  material: Material<Normal<TParams>>;
  Params: TraitFor<Infer<Normal<TParams>>>;
  Bundle(params?: Infer<Normal<TParams>>): ConfigurableTrait[];
} {
  const { paramsSchema, paramsDefaults, vertexLayout, createPipeline } =
    options;
  const pipelineStore = new WeakMap<TgpuRoot, TgpuRenderPipeline<Vec4f>>();

  const paramsLayout = paramsSchema
    ? (tgpu.bindGroupLayout({
        params: { uniform: paramsSchema },
      }) as TgpuBindGroupLayout<{
        params: { uniform: Normal<TParams> };
      }>)
    : undefined;

  const material: Material<Normal<TParams>> = {
    paramsSchema: paramsSchema as Normal<TParams> | undefined,
    paramsLayout,
    vertexLayout,
    paramsDefaults,

    getPipeline(
      root: TgpuRoot,
      format: GPUTextureFormat,
    ): TgpuRenderPipeline<Vec4f> {
      const memo = pipelineStore.get(root);
      if (memo) {
        return memo;
      }

      const { pipeline } = createPipeline({
        root,
        format,

        getParams(): { value: Infer<Normal<TParams>> } {
          return paramsLayout?.bound.params as {
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

  const paramsTrait = trait(paramsDefaults as Schema) as TraitFor<
    Infer<Normal<TParams>>
  >;

  return {
    material,
    Params: paramsTrait,
    Bundle: (params) => [
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      MaterialTrait({ material, paramsTrait: paramsTrait as any }),
      params ? paramsTrait(params) : paramsTrait,
    ],
  };
}
