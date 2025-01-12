import { type ConfigurableTrait, type Schema, type Trait, trait } from 'koota';
import {
  type AnyWgslData,
  type BaseWgslData,
  type Infer,
  type Mat4x4f,
  type Normal,
  type Vec4f,
  type WgslStruct,
  type m4x4f,
  mat4x4f,
  struct,
} from 'typegpu/data';
import {
  type TgpuBindGroup,
  type TgpuBindGroupLayout,
  type TgpuRenderPipeline,
  type ExperimentalTgpuRoot as TgpuRoot,
  type TgpuVertexLayout,
  tgpu,
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
  readonly instanceLayout: TgpuVertexLayout | undefined;
  readonly paramsDefaults: Infer<TParams> | undefined;
  getPipeline(
    root: TgpuRoot,
    format: GPUTextureFormat,
  ): TgpuRenderPipeline<Vec4f>;
}

export const UniformsStruct: WgslStruct<{
  modelMat: Mat4x4f;
  normalModelMat: Mat4x4f;
}> = struct({
  modelMat: mat4x4f,
  normalModelMat: mat4x4f,
});

export const POVStruct: WgslStruct<{ viewProjMat: Mat4x4f }> = struct({
  viewProjMat: mat4x4f,
});

export const sharedBindGroupLayout: TgpuBindGroupLayout<{
  pov: { uniform: typeof POVStruct };
}> = tgpu.bindGroupLayout({
  pov: { uniform: POVStruct },
});

export const uniformsBindGroupLayout: TgpuBindGroupLayout<{
  uniforms: { uniform: typeof UniformsStruct };
}> = tgpu.bindGroupLayout({
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

export const MaterialTrait: Trait<{
  material: Material;
  paramsTrait: Trait;
}> = trait({
  material: {} as Material,
  paramsTrait: {} as Trait,
});

export type CreateMaterialResult<TParams extends AnyWgslData> = {
  material: Material<Normal<TParams>>;
  Params: TraitFor<Infer<Normal<TParams>>>;
  Bundle(params?: Infer<Normal<TParams>>): ConfigurableTrait[];
};

export function createMaterial<TParams extends AnyWgslData>(
  options: {
    paramsSchema?: TParams;
    vertexLayout: TgpuVertexLayout;
    instanceLayout?: TgpuVertexLayout;
    createPipeline: (ctx: MaterialContext<Normal<TParams>>) => MaterialOptions;
  } & (AnyWgslData extends TParams
    ? { paramsDefaults?: undefined }
    : { paramsDefaults: Infer<Normal<TParams>> }),
): CreateMaterialResult<TParams> {
  const {
    paramsSchema,
    paramsDefaults,
    vertexLayout,
    instanceLayout,
    createPipeline,
  } = options;
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
    instanceLayout,
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
