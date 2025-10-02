import { type ConfigurableTrait, type Schema, type Trait, trait } from 'koota';
import {
  type TgpuBindGroup,
  type TgpuBindGroupLayout,
  type TgpuRenderPipeline,
  type TgpuRoot,
  type TgpuVertexLayout,
  tgpu,
} from 'typegpu';
import {
  type AnyWgslData,
  type BaseWgslData,
  type Infer,
  type Mat4x4f,
  type Vec4f,
  type WgslStruct,
  type m4x4f,
  mat4x4f,
  struct,
} from 'typegpu/data';

export interface MaterialContext<TParams> {
  readonly root: TgpuRoot;
  readonly format: GPUTextureFormat;
  readonly $$: {
    readonly viewProjMat: m4x4f;
    readonly invViewProjMat: m4x4f;
    readonly modelMat: m4x4f;
    readonly normalModelMat: m4x4f;
    readonly params: Infer<TParams>;
  };
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

export const POVStruct: WgslStruct<{
  viewProjMat: Mat4x4f;
  invViewProjMat: Mat4x4f;
}> = struct({
  viewProjMat: mat4x4f,
  invViewProjMat: mat4x4f,
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
  material: () => Material;
  paramsTrait: () => Trait;
}> = trait({
  material: () => undefined as unknown as Material,
  paramsTrait: () => undefined as unknown as Trait,
});

export type CreateMaterialResult<TParams extends AnyWgslData> = {
  material: Material<TParams>;
  Params: TraitFor<() => Infer<TParams>>;
  Bundle(params?: Infer<TParams>): ConfigurableTrait[];
};

export function createMaterial(options: {
  paramsSchema?: undefined;
  paramsDefaults?: undefined;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (ctx: MaterialContext<AnyWgslData>) => MaterialOptions;
}): CreateMaterialResult<AnyWgslData>;
export function createMaterial<TParams extends AnyWgslData>(options: {
  paramsSchema: TParams;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (ctx: MaterialContext<NoInfer<TParams>>) => MaterialOptions;

  paramsDefaults: Infer<TParams>;
}): CreateMaterialResult<TParams>;
export function createMaterial<TParams extends AnyWgslData>(options: {
  paramsSchema?: TParams | undefined;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (ctx: MaterialContext<NoInfer<TParams>>) => MaterialOptions;

  paramsDefaults?: Infer<TParams> | undefined;
}): CreateMaterialResult<TParams> {
  const {
    paramsSchema,
    paramsDefaults,
    vertexLayout,
    instanceLayout,
    createPipeline,
  } = options;
  const pipelineStore = new WeakMap<TgpuRoot, TgpuRenderPipeline<Vec4f>>();

  const paramsLayout = paramsSchema
    ? tgpu.bindGroupLayout({
        params: { uniform: paramsSchema },
      })
    : undefined;

  const material: Material<TParams> = {
    paramsSchema,
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

        $$: {
          get viewProjMat() {
            return pov.value.viewProjMat;
          },
          get invViewProjMat() {
            return pov.value.invViewProjMat;
          },
          get modelMat() {
            return uniforms.value.modelMat;
          },
          get normalModelMat() {
            return uniforms.value.normalModelMat;
          },
          get params(): Infer<TParams> {
            return paramsLayout?.bound.params.value as Infer<TParams>;
          },
        },
      });

      pipelineStore.set(root, pipeline);
      return pipeline;
    },
  };

  const paramsTrait = trait(() => paramsDefaults) as TraitFor<
    () => Infer<TParams>
  >;

  return {
    material,
    Params: paramsTrait,
    Bundle: (params) => [
      // biome-ignore lint/suspicious/noExplicitAny: it's complicated
      MaterialTrait({ material, paramsTrait: paramsTrait as any }),
      params ? paramsTrait(params) : paramsTrait,
    ],
  };
}
