import {
  type AnyWgslData,
  type Disarray,
  type WgslArray,
  type m4x4f,
  mat4x4f,
  vec4f,
} from 'typegpu/data';
import type {
  TgpuRoot,
  TgpuBindGroup,
  TgpuBuffer,
  TgpuRenderPipeline,
  Uniform,
  Vertex,
} from 'typegpu';
import { add } from 'typegpu/std';
import { mat4 } from 'wgpu-matrix';

import type { MeshAsset } from '../asset/mesh-asset.js';
import type { PerspectiveConfig } from '../camera-traits.js';
import type { Transform } from '../transform.js';
import {
  type Material,
  POVStruct,
  type SharedBindGroup,
  type UniformsBindGroup,
  UniformsStruct,
  sharedBindGroupLayout,
  uniformsBindGroupLayout,
} from './material.js';
import { Viewport } from './viewport.js';

export type GameObject = {
  id: number;
  meshAsset: MeshAsset;
  instanceBuffer?: (TgpuBuffer<WgslArray | Disarray> & Vertex) | undefined;
  worldMatrix: m4x4f;
  material: Material;
  materialParams: unknown;
};

type ObjectResources = {
  uniformsBindGroup: UniformsBindGroup;
  uniformsBuffer: TgpuBuffer<typeof UniformsStruct> & Uniform;

  instanceParamsBindGroup: TgpuBindGroup | undefined;
  instanceParamsBuffer: (TgpuBuffer<AnyWgslData> & Uniform) | undefined;
};

export class Renderer {
  private _objects: GameObject[] = [];
  private readonly _matrices: {
    proj: m4x4f;
    view: m4x4f;
    model: m4x4f;
    normalModel: m4x4f;
  };
  private readonly _viewport: Viewport;
  private readonly _povBuffer: TgpuBuffer<typeof POVStruct> & Uniform;
  private readonly _sharedBindGroup: SharedBindGroup;
  private readonly _presentationFormat: GPUTextureFormat;
  private readonly _cachedResources = new Map<number, ObjectResources>();
  private _cameraConfig: PerspectiveConfig | null = null;

  constructor(
    public readonly root: TgpuRoot,
    public readonly canvas: HTMLCanvasElement,
    private readonly _context: GPUCanvasContext,
  ) {
    const device = root.device;

    this._presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this._context.configure({
      device: device,
      format: this._presentationFormat,
      alphaMode: 'premultiplied',
    });

    this._viewport = new Viewport(root, canvas.width, canvas.height);

    this._matrices = {
      proj: mat4.identity(mat4x4f()),
      view: mat4.identity(mat4x4f()),
      model: mat4.identity(mat4x4f()),
      normalModel: mat4.identity(mat4x4f()),
    };

    this._povBuffer = root
      .createBuffer(POVStruct, {
        viewProjMat: mat4.identity(mat4x4f()),
      })
      .$usage('uniform');

    this._sharedBindGroup = root.createBindGroup(sharedBindGroupLayout, {
      pov: this._povBuffer,
    });
  }

  private _updateProjection() {
    mat4.perspective(
      ((this._cameraConfig?.fov ?? 45) / 180) * Math.PI, // fov
      this._viewport.width / this._viewport.height, // aspect
      this._cameraConfig?.near ?? 0.1, // near
      this._cameraConfig?.far ?? 1000.0, // far
      this._matrices.proj,
    );
  }

  private _updatePOV() {
    const viewProjMat = mat4.mul(
      this._matrices.proj,
      this._matrices.view,
      mat4x4f(),
    );
    this._povBuffer.write({ viewProjMat });
  }

  private _resourcesFor(id: number, material: Material): ObjectResources {
    let resources = this._cachedResources.get(id);

    if (!resources) {
      const uniformsBuffer = this.root
        .createBuffer(UniformsStruct, {
          modelMat: mat4.identity(mat4x4f()),
          normalModelMat: mat4.identity(mat4x4f()),
        })
        .$usage('uniform');

      const uniformsBindGroup = this.root.createBindGroup(
        uniformsBindGroupLayout,
        {
          uniforms: uniformsBuffer,
        },
      );

      const instanceParamsBuffer = material.paramsSchema
        ? this.root
            .createBuffer(material.paramsSchema as AnyWgslData)
            .$usage('uniform')
        : undefined;

      const instanceParamsBindGroup =
        instanceParamsBuffer && material.paramsLayout
          ? this.root.createBindGroup(material.paramsLayout, {
              params: instanceParamsBuffer,
            })
          : undefined;

      resources = {
        uniformsBindGroup,
        uniformsBuffer,
        instanceParamsBuffer,
        instanceParamsBindGroup,
      };
      this._cachedResources.set(id, resources);
    }

    return resources;
  }

  private _recomputeUniformsFor({
    id,
    worldMatrix,
    material,
    materialParams,
  }: GameObject) {
    const { uniformsBuffer, instanceParamsBuffer } = this._resourcesFor(
      id,
      material,
    );

    mat4.invert(worldMatrix, this._matrices.normalModel);
    mat4.transpose(this._matrices.normalModel, this._matrices.normalModel);

    uniformsBuffer.write({
      modelMat: worldMatrix,
      normalModelMat: this._matrices.normalModel,
    });

    instanceParamsBuffer?.write(materialParams);
  }

  render() {
    this._updatePOV();

    for (const obj of this._objects) {
      this._recomputeUniformsFor(obj);
    }

    const targetView = this._context.getCurrentTexture().createView();

    let firstPass = true;
    for (const { id, meshAsset, instanceBuffer, material } of this._objects) {
      const mesh = meshAsset.peek(this.root);
      if (!mesh) {
        // Mesh is not loaded yet...
        continue;
      }

      const pipeline = material.getPipeline(
        this.root,
        this._presentationFormat,
      );

      const { uniformsBindGroup, instanceParamsBindGroup } = this._resourcesFor(
        id,
        material,
      );

      const withOptionals = <T extends TgpuRenderPipeline>(pipeline: T) => {
        let result = pipeline;

        if (material.paramsLayout && instanceParamsBindGroup) {
          result = result.with(
            material.paramsLayout,
            instanceParamsBindGroup,
          ) as T;
        }

        if (material.instanceLayout && instanceBuffer) {
          result = result.with(material.instanceLayout, instanceBuffer) as T;
        }

        return result;
      };

      withOptionals(pipeline)
        .with(sharedBindGroupLayout, this._sharedBindGroup)
        .with(uniformsBindGroupLayout, uniformsBindGroup)
        .with(material.vertexLayout, mesh.vertexBuffer)
        .withColorAttachment({
          view: targetView,
          loadOp: firstPass ? 'clear' : 'load',
          storeOp: 'store',
          clearValue: this._cameraConfig?.clearColor ?? {
            r: 0.0,
            g: 0.0,
            b: 0.0,
            a: 1.0,
          },
        })
        .withDepthStencilAttachment({
          view: this._viewport.depthTextureView,
          depthLoadOp: firstPass ? 'clear' : 'load',
          depthStoreOp: 'store',
          depthClearValue: 1.0,
        })
        .draw(
          mesh.vertexCount,
          instanceBuffer ? instanceBuffer.dataType.elementCount : undefined,
        );

      firstPass = false;
    }

    this.root['~unstable'].flush();

    // In react-native-wgpu, we have to call `context.present` in order
    // to show what's been drawn to the canvas.
    if ('present' in this._context) {
      (this._context.present as () => void)();
    }
  }

  updateViewport(width: number, height: number) {
    this._viewport.resize(width, height);
    this._updateProjection();
  }

  setPerspectivePOV(transform: Transform, config: PerspectiveConfig) {
    const rotation = mat4.fromQuat(transform.rotation);
    const forward = mat4.mul(rotation, vec4f(0, 0, -1, 0), vec4f());
    const up = mat4.mul(rotation, vec4f(0, 1, 0, 0), vec4f());

    mat4.identity(this._matrices.view);
    mat4.lookAt(
      transform.position,
      add(transform.position, forward.xyz),
      up.xyz,
      this._matrices.view,
    );

    this._cameraConfig = config;
    this._updateProjection();
  }

  addObject(object: GameObject) {
    this._objects.push(object);
  }

  removeObject(id: number) {
    this._objects = this._objects.filter((obj) => obj.id !== id);
  }
}
