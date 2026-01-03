import { type ConfigurableTrait, type Schema, type Trait, trait } from 'koota';
import {
  type ExtractBindGroupInputFromLayout,
  type TgpuBindGroup,
  type TgpuBindGroupLayout,
  type TgpuLayoutEntry,
  type TgpuRenderPipeline,
  type TgpuRoot,
  type TgpuVertexLayout,
  tgpu,
} from 'typegpu';
import * as d from 'typegpu/data';

export interface MaterialContext<
  TParams extends d.BaseWgslData,
  TBindings extends Record<string, TgpuLayoutEntry | null>,
> {
  readonly root: TgpuRoot;
  readonly format: GPUTextureFormat;
  readonly $$: {
    readonly viewProjMat: d.m4x4f;
    readonly invViewProjMat: d.m4x4f;
    readonly modelMat: d.m4x4f;
    readonly invModelMat: d.m4x4f;
    readonly normalModelMat: d.m4x4f;
    readonly params: d.Infer<TParams>;
    readonly bindings: TgpuBindGroupLayout<TBindings>['$'];
  };
}

export interface MaterialOptions {
  pipeline: TgpuRenderPipeline;
}

export interface Material<TParams extends d.BaseWgslData = d.BaseWgslData> {
  readonly paramsSchema: TParams | undefined;
  readonly paramsLayout: TgpuBindGroupLayout | undefined;
  readonly vertexLayout: TgpuVertexLayout;
  readonly instanceLayout: TgpuVertexLayout | undefined;
  readonly paramsDefaults: d.Infer<TParams> | undefined;
  getPipeline(
    root: TgpuRoot,
    format: GPUTextureFormat,
  ): TgpuRenderPipeline<d.Vec4f>;
}

export const UniformsStruct: d.WgslStruct<{
  modelMat: d.Mat4x4f;
  invModelMat: d.Mat4x4f;
  normalModelMat: d.Mat4x4f;
}> = d.struct({
  modelMat: d.mat4x4f,
  invModelMat: d.mat4x4f,
  normalModelMat: d.mat4x4f,
});

export const POVStruct: d.WgslStruct<{
  viewOrigin: d.Vec3f;
  viewDir: d.Vec3f;
  viewProjMat: d.Mat4x4f;
  invViewProjMat: d.Mat4x4f;
}> = d.struct({
  viewOrigin: d.vec3f,
  viewDir: d.vec3f,
  viewProjMat: d.mat4x4f,
  invViewProjMat: d.mat4x4f,
});

export const sharedBindGroupLayout: TgpuBindGroupLayout<{
  pov: { uniform: typeof POVStruct };
}> = tgpu
  .bindGroupLayout({
    pov: { uniform: POVStruct },
  })
  .$name('wayfare-sharedBindGroupLayout');

export const uniformsBindGroupLayout: TgpuBindGroupLayout<{
  uniforms: { uniform: typeof UniformsStruct };
}> = tgpu
  .bindGroupLayout({
    uniforms: { uniform: UniformsStruct },
  })
  .$name('wayfare-uniformsBindGroupLayout');

export type SharedBindGroup = TgpuBindGroup<
  (typeof sharedBindGroupLayout)['entries']
>;

export type UniformsBindGroup = TgpuBindGroup<
  (typeof uniformsBindGroupLayout)['entries']
>;

const { pov } = sharedBindGroupLayout.bound;
const { uniforms } = uniformsBindGroupLayout.bound;

type TraitFor<T> = T extends Schema ? Trait<T> : never;

export const ExtraBindingTrait: Trait<{
  group: () => TgpuBindGroup | undefined;
}> = trait({
  group: () => undefined as TgpuBindGroup | undefined,
});

export const MaterialTrait: Trait<{
  material: () => Material;
  paramsTrait: () => Trait;
  bindingsTrait: () => Trait;
}> = trait({
  material: () => undefined as unknown as Material,
  paramsTrait: () => undefined as unknown as Trait,
  bindingsTrait: () => undefined as unknown as Trait,
});

export type CreateMaterialResult<
  TParams extends d.AnyWgslData,
  TBindings extends Record<string, TgpuLayoutEntry | null> = Record<
    string,
    never
  >,
> = {
  material: Material<TParams>;
  Params: TraitFor<() => d.Infer<TParams>>;
  Bindings: TraitFor<() => Partial<ExtractBindGroupInputFromLayout<TBindings>>>;
  Bundle(
    params?: d.Infer<TParams>,
    bindings?: Partial<ExtractBindGroupInputFromLayout<TBindings>>,
  ): ConfigurableTrait[];
};

function tryCall(cb: unknown) {
  if (typeof cb !== 'function') {
    throw new Error('Params schema is not callable');
  }
  return cb();
}

export function createMaterial(options: {
  paramsSchema?: undefined;
  paramsDefaults?: undefined;
  bindings?: undefined;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (
    ctx: MaterialContext<d.AnyWgslData, Record<string, never>>,
  ) => MaterialOptions;
}): CreateMaterialResult<d.AnyWgslData, Record<string, never>>;
export function createMaterial<TParams extends d.AnyWgslData>(options: {
  paramsSchema: TParams;
  paramsDefaults?: d.Infer<NoInfer<TParams>> | undefined;
  bindings?: undefined;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (
    ctx: MaterialContext<NoInfer<TParams>, Record<string, never>>,
  ) => MaterialOptions;
}): CreateMaterialResult<TParams, Record<string, never>>;
export function createMaterial<
  TBindings extends Record<string, TgpuLayoutEntry | null>,
>(options: {
  paramsSchema?: undefined;
  paramsDefaults?: undefined;
  bindings: TBindings;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (
    ctx: MaterialContext<d.AnyWgslData, NoInfer<TBindings>>,
  ) => MaterialOptions;
}): CreateMaterialResult<d.AnyWgslData, TBindings>;
export function createMaterial<
  TParams extends d.AnyWgslData,
  TBindings extends Record<string, TgpuLayoutEntry | null>,
>(options: {
  paramsSchema: TParams;
  paramsDefaults?: d.Infer<TParams> | undefined;
  bindings: TBindings;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (
    ctx: MaterialContext<NoInfer<TParams>, NoInfer<TBindings>>,
  ) => MaterialOptions;
}): CreateMaterialResult<TParams, TBindings>;
export function createMaterial<
  TParams extends d.AnyWgslData,
  TBindings extends Record<string, TgpuLayoutEntry | null>,
>(options: {
  paramsSchema?: TParams | undefined;
  paramsDefaults?: d.Infer<TParams> | undefined;
  bindings?: TBindings | undefined;
  vertexLayout: TgpuVertexLayout;
  instanceLayout?: TgpuVertexLayout;
  createPipeline: (
    ctx: MaterialContext<NoInfer<TParams>, NoInfer<TBindings>>,
  ) => MaterialOptions;
}): CreateMaterialResult<TParams, TBindings> {
  const {
    paramsSchema,
    bindings,
    paramsDefaults = paramsSchema ? tryCall(paramsSchema) : undefined,
    vertexLayout,
    instanceLayout,
    createPipeline,
  } = options;
  const pipelineStore = new WeakMap<TgpuRoot, TgpuRenderPipeline<d.Vec4f>>();

  if (bindings && 'params' in bindings) {
    throw new Error(
      'bindings.params is reserved for the `paramsSchema`, please choose a different name',
    );
  }

  const paramsLayout =
    paramsSchema || bindings
      ? tgpu
          .bindGroupLayout({
            ...bindings,
            ...(paramsSchema ? { params: { uniform: paramsSchema } } : {}),
          })
          .$name('wayfare-materialParamsLayout')
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
    ): TgpuRenderPipeline<d.Vec4f> {
      const memo = pipelineStore.get(root);
      if (memo) {
        return memo;
      }

      const { pipeline } = createPipeline({
        root,
        format,

        $$: {
          get viewProjMat() {
            return pov.$.viewProjMat;
          },
          get invViewProjMat() {
            return pov.$.invViewProjMat;
          },
          get modelMat() {
            return uniforms.$.modelMat;
          },
          get invModelMat() {
            return uniforms.$.invModelMat;
          },
          get normalModelMat() {
            return uniforms.$.normalModelMat;
          },
          get params(): d.Infer<TParams> {
            return paramsLayout?.bound.params?.$ as d.Infer<TParams>;
          },
          get bindings(): TgpuBindGroupLayout<TBindings>['$'] {
            return paramsLayout?.$ as TgpuBindGroupLayout<TBindings>['$'];
          },
        },
      });

      pipelineStore.set(root, pipeline);
      return pipeline;
    },
  };

  const paramsTrait = trait(() => paramsDefaults) as TraitFor<
    () => d.Infer<TParams>
  >;

  const bindingsTrait = trait(
    () => ({}) as Partial<ExtractBindGroupInputFromLayout<TBindings>>,
  ) as unknown as TraitFor<
    () => Partial<ExtractBindGroupInputFromLayout<TBindings>>
  >;

  return {
    material,
    Params: paramsTrait,
    Bindings: bindingsTrait,
    Bundle: (
      params,
      bindings?: Partial<ExtractBindGroupInputFromLayout<TBindings>>,
    ) => [
      MaterialTrait({
        material,
        // biome-ignore lint/suspicious/noExplicitAny: it's complicated
        paramsTrait: paramsTrait as any,
        // biome-ignore lint/suspicious/noExplicitAny: it's complicated
        bindingsTrait: bindingsTrait as any,
      }),
      params ? paramsTrait(params) : paramsTrait,
      bindings ? bindingsTrait(bindings) : bindingsTrait,
    ],
  };
}
