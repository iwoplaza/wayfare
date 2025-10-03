import type {
  TgpuBindGroup,
  TgpuBuffer,
  TgpuRoot,
  UniformFlag,
  VertexFlag,
} from 'typegpu';
import {
  type AnyWgslData,
  type Disarray,
  type WgslArray,
  type m4x4f,
  mat4x4f,
  vec4f,
} from 'typegpu/data';
import { add } from 'typegpu/std';
import { mat4 } from 'wgpu-matrix';

import type { MeshAsset } from '../asset/mesh-asset.ts';
import type {
  OrthographicConfig,
  PerspectiveConfig,
} from '../camera-traits.ts';
import type { Transform } from '../transform.ts';
import {
  type Material,
  POVStruct,
  type SharedBindGroup,
  type UniformsBindGroup,
  UniformsStruct,
  sharedBindGroupLayout,
  uniformsBindGroupLayout,
} from './material.ts';
import { Viewport } from './viewport.ts';

export type GameObject = {
  id: number;
  meshAsset: MeshAsset;
  instanceBuffer?: (TgpuBuffer<WgslArray | Disarray> & VertexFlag) | undefined;
  worldMatrix: m4x4f;
  material: Material;
  materialParams: unknown;
  readonly extraBinding: TgpuBindGroup | undefined;
};

type ObjectResources = {
  uniformsBindGroup: UniformsBindGroup;
  uniformsBuffer: TgpuBuffer<typeof UniformsStruct> & UniformFlag;

  instanceParamsBindGroup: TgpuBindGroup | undefined;
  instanceParamsBuffer: (TgpuBuffer<AnyWgslData> & UniformFlag) | undefined;
};

type RenderOverrides = {
  material?: Material;
  colorAttachments?: GPURenderPassColorAttachment[];
  depthStencilAttachment?: GPURenderPassDepthStencilAttachment | undefined;
  filterObjects?: ((entityId: number) => boolean) | undefined;
};

export class Renderer {
  private _objects: GameObject[] = [];
  private readonly _matrices: {
    proj: m4x4f;
    view: m4x4f;
    model: m4x4f;
    invModel: m4x4f;
    normalModel: m4x4f;
  };
  private readonly _viewport: Viewport;
  private readonly _povBuffer: TgpuBuffer<typeof POVStruct> & UniformFlag;
  private readonly _sharedBindGroup: SharedBindGroup;
  private readonly _presentationFormat: GPUTextureFormat;
  private readonly _cachedResources = new Map<number, ObjectResources>();
  private _cameraConfig: PerspectiveConfig | OrthographicConfig | null = null;

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
      invModel: mat4.identity(mat4x4f()),
      normalModel: mat4.identity(mat4x4f()),
    };

    this._povBuffer = root
      .createBuffer(POVStruct, {
        viewProjMat: mat4.identity(mat4x4f()),
        invViewProjMat: mat4.identity(mat4x4f()),
      })
      .$usage('uniform');

    this._sharedBindGroup = root.createBindGroup(sharedBindGroupLayout, {
      pov: this._povBuffer,
    });
  }

  private _updateProjection() {
    if (!this._cameraConfig) return;

    if (this._cameraConfig.type === 'perspective') {
      mat4.perspective(
        ((this._cameraConfig?.fov ?? 45) / 180) * Math.PI, // fov
        this._viewport.width / this._viewport.height, // aspect
        this._cameraConfig?.near ?? 0.1, // near
        this._cameraConfig?.far ?? 1000.0, // far
        this._matrices.proj,
      );
    } else if (this._cameraConfig.type === 'orthographic') {
      mat4.ortho(
        this._cameraConfig.left,
        this._cameraConfig.right,
        this._cameraConfig.bottom,
        this._cameraConfig.top,
        this._cameraConfig.near,
        this._cameraConfig.far,
        this._matrices.proj,
      );
    }
  }

  private _updatePOV() {
    const viewProjMat = mat4.mul(
      this._matrices.proj,
      this._matrices.view,
      mat4x4f(),
    );
    const invViewProjMat = mat4.invert(viewProjMat, mat4x4f());
    this._povBuffer.write({ viewProjMat, invViewProjMat });
  }

  private _resourcesFor(id: number, material: Material): ObjectResources {
    let resources = this._cachedResources.get(id);

    if (!resources) {
      const uniformsBuffer = this.root
        .createBuffer(UniformsStruct, {
          modelMat: mat4.identity(mat4x4f()),
          invModelMat: mat4.identity(mat4x4f()),
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

    mat4.invert(worldMatrix, this._matrices.invModel);
    mat4.transpose(this._matrices.invModel, this._matrices.normalModel);

    uniformsBuffer.write({
      modelMat: worldMatrix,
      invModelMat: this._matrices.invModel,
      normalModelMat: this._matrices.normalModel,
    });

    instanceParamsBuffer?.write(materialParams);
  }

  render(overrides?: RenderOverrides | undefined) {
    if (overrides?.material && overrides.material.paramsSchema !== undefined) {
      throw new Error('Material override cannot have parameters');
    }

    this._updatePOV();

    for (const obj of this._objects) {
      this._recomputeUniformsFor(obj);
    }

    const targetView = this._context.getCurrentTexture().createView();

    this.root['~unstable'].beginRenderPass(
      {
        colorAttachments: overrides?.colorAttachments ?? [
          {
            view: targetView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: this._cameraConfig?.clearColor ?? {
              r: 0.0,
              g: 0.0,
              b: 0.0,
              a: 1.0,
            },
          },
        ],
        depthStencilAttachment: overrides?.depthStencilAttachment ?? {
          view: this._viewport.depthTextureView,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
          depthClearValue: 1.0,
        },
      },
      (pass) => {
        for (const {
          id,
          meshAsset,
          instanceBuffer,
          material,
          extraBinding,
        } of this._objects) {
          if (overrides?.filterObjects && !overrides?.filterObjects(id)) {
            continue;
          }

          const mesh = meshAsset.peek(this.root);
          if (!mesh) {
            // Mesh is not loaded yet...
            continue;
          }

          const overrideMaterial = overrides?.material;
          const realMaterial = overrideMaterial ?? material;
          const pipeline = realMaterial.getPipeline(
            this.root,
            this._presentationFormat,
          );

          const { uniformsBindGroup, instanceParamsBindGroup } =
            this._resourcesFor(id, material);

          pass.setPipeline(pipeline);
          pass.setBindGroup(sharedBindGroupLayout, this._sharedBindGroup);
          pass.setBindGroup(uniformsBindGroupLayout, uniformsBindGroup);
          pass.setVertexBuffer(realMaterial.vertexLayout, mesh.vertexBuffer);

          if (
            !overrides?.material &&
            material.paramsLayout &&
            instanceParamsBindGroup
          ) {
            pass.setBindGroup(material.paramsLayout, instanceParamsBindGroup);
          }

          if (realMaterial.instanceLayout && instanceBuffer) {
            pass.setVertexBuffer(realMaterial.instanceLayout, instanceBuffer);
          }

          if (extraBinding) {
            pass.setBindGroup(extraBinding.layout, extraBinding);
          }

          pass.draw(
            mesh.vertexCount,
            instanceBuffer ? instanceBuffer.dataType.elementCount : undefined,
          );
        }
      },
    );

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

  setPOV(transform: Transform, config: OrthographicConfig | PerspectiveConfig) {
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
