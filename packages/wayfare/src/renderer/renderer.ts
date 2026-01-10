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
  vec2u,
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
  readonly bindings: Record<string, unknown> | undefined;
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
  #objects: GameObject[] = [];
  readonly #matrices: {
    proj: m4x4f;
    view: m4x4f;
    invView: m4x4f;
    model: m4x4f;
    invModel: m4x4f;
    normalModel: m4x4f;
  };
  readonly #viewport: Viewport;
  readonly #povBuffer: TgpuBuffer<typeof POVStruct> & UniformFlag;
  readonly #sharedBindGroup: SharedBindGroup;
  readonly #presentationFormat: GPUTextureFormat;
  readonly #cachedResources = new Map<number, ObjectResources>();
  #cameraConfig: PerspectiveConfig | OrthographicConfig | null = null;

  readonly root: TgpuRoot;
  readonly canvas: HTMLCanvasElement;
  readonly context: GPUCanvasContext;

  constructor(
    root: TgpuRoot,
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
  ) {
    this.root = root;
    this.canvas = canvas;
    this.context = context;

    const device = root.device;

    this.#presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: device,
      format: this.#presentationFormat,
      alphaMode: 'premultiplied',
    });

    this.#viewport = new Viewport(root, canvas.width, canvas.height);

    this.#matrices = {
      proj: mat4.identity(mat4x4f()),
      view: mat4.identity(mat4x4f()),
      invView: mat4.identity(mat4x4f()),
      model: mat4.identity(mat4x4f()),
      invModel: mat4.identity(mat4x4f()),
      normalModel: mat4.identity(mat4x4f()),
    };

    this.#povBuffer = root.createBuffer(POVStruct).$usage('uniform');

    this.#sharedBindGroup = root.createBindGroup(sharedBindGroupLayout, {
      pov: this.#povBuffer,
    });
  }

  #updateProjection() {
    if (!this.#cameraConfig) return;

    if (this.#cameraConfig.type === 'perspective') {
      mat4.perspective(
        ((this.#cameraConfig?.fov ?? 45) / 180) * Math.PI, // fov
        this.#viewport.width / this.#viewport.height, // aspect
        this.#cameraConfig?.near ?? 0.1, // near
        this.#cameraConfig?.far ?? 1000.0, // far
        this.#matrices.proj,
      );
    } else if (this.#cameraConfig.type === 'orthographic') {
      mat4.ortho(
        this.#cameraConfig.left,
        this.#cameraConfig.right,
        this.#cameraConfig.bottom,
        this.#cameraConfig.top,
        this.#cameraConfig.near,
        this.#cameraConfig.far,
        this.#matrices.proj,
      );
    }
  }

  #updatePOV() {
    const viewProjMat = mat4.mul(
      this.#matrices.proj,
      this.#matrices.view,
      mat4x4f(),
    );
    const invViewProjMat = mat4.invert(viewProjMat, mat4x4f());
    this.#povBuffer.write({
      viewport: vec2u(this.#viewport.width, this.#viewport.height),
      viewMat: this.#matrices.view,
      invViewMat: this.#matrices.invView,
      viewProjMat,
      invViewProjMat,
    });
  }

  #resourcesFor(obj: GameObject): ObjectResources {
    let resources = this.#cachedResources.get(obj.id);

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

      const instanceParamsBuffer = obj.material.paramsSchema
        ? this.root
          .createBuffer(obj.material.paramsSchema as AnyWgslData)
          .$usage('uniform')
        : undefined;

      const instanceParamsBindGroup = obj.material.paramsLayout
        ? this.root.createBindGroup(obj.material.paramsLayout, {
          ...(instanceParamsBuffer ? { params: instanceParamsBuffer } : {}),
          ...obj.bindings,
        })
        : undefined;

      resources = {
        uniformsBindGroup,
        uniformsBuffer,
        instanceParamsBuffer,
        instanceParamsBindGroup,
      };
      this.#cachedResources.set(obj.id, resources);
    } else if (obj.bindings) {
      // Recreating the group on every render
      resources.instanceParamsBindGroup = obj.material.paramsLayout
        ? this.root.createBindGroup(obj.material.paramsLayout, {
          ...(resources.instanceParamsBuffer
            ? { params: resources.instanceParamsBuffer }
            : {}),
          ...obj.bindings,
        })
        : undefined;
    }

    return resources;
  }

  #recomputeUniformsFor(obj: GameObject) {
    const { uniformsBuffer, instanceParamsBuffer } = this.#resourcesFor(obj);

    mat4.invert(obj.worldMatrix, this.#matrices.invModel);
    mat4.transpose(this.#matrices.invModel, this.#matrices.normalModel);

    uniformsBuffer.write({
      modelMat: obj.worldMatrix,
      invModelMat: this.#matrices.invModel,
      normalModelMat: this.#matrices.normalModel,
    });

    instanceParamsBuffer?.write(obj.materialParams);
  }

  render(overrides?: RenderOverrides | undefined) {
    if (overrides?.material && overrides.material.paramsSchema !== undefined) {
      throw new Error('Material override cannot have parameters');
    }

    this.#updatePOV();

    for (const obj of this.#objects) {
      this.#recomputeUniformsFor(obj);
    }

    const targetView = this.context.getCurrentTexture().createView();

    this.root['~unstable'].beginRenderPass(
      {
        colorAttachments: overrides?.colorAttachments ?? [
          {
            view: targetView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: this.#cameraConfig?.clearColor ?? {
              r: 0.0,
              g: 0.0,
              b: 0.0,
              a: 1.0,
            },
          },
        ],
        depthStencilAttachment: overrides?.depthStencilAttachment ?? {
          view: this.#viewport.depthTextureView,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
          depthClearValue: 1.0,
        },
      },
      (pass) => {
        for (const obj of this.#objects) {
          if (overrides?.filterObjects && !overrides?.filterObjects(obj.id)) {
            continue;
          }

          const mesh = obj.meshAsset.peek(this.root);
          if (!mesh) {
            // Mesh is not loaded yet...
            continue;
          }

          const overrideMaterial = overrides?.material;
          const realMaterial = overrideMaterial ?? obj.material;
          const pipeline = realMaterial.getPipeline(
            this.root,
            this.#presentationFormat,
          );

          const { uniformsBindGroup, instanceParamsBindGroup } =
            this.#resourcesFor(obj);

          pass.setPipeline(pipeline);
          pass.setBindGroup(sharedBindGroupLayout, this.#sharedBindGroup);
          pass.setBindGroup(uniformsBindGroupLayout, uniformsBindGroup);
          pass.setVertexBuffer(realMaterial.vertexLayout, mesh.vertexBuffer);

          if (
            !overrides?.material &&
            obj.material.paramsLayout &&
            instanceParamsBindGroup
          ) {
            pass.setBindGroup(
              obj.material.paramsLayout,
              instanceParamsBindGroup,
            );
          }

          if (realMaterial.instanceLayout && obj.instanceBuffer) {
            pass.setVertexBuffer(
              realMaterial.instanceLayout,
              obj.instanceBuffer,
            );
          }

          if (obj.extraBinding) {
            pass.setBindGroup(obj.extraBinding.layout, obj.extraBinding);
          }

          pass.draw(
            mesh.vertexCount,
            obj.instanceBuffer
              ? obj.instanceBuffer.dataType.elementCount
              : undefined,
          );
        }
      },
    );

    // In react-native-wgpu, we have to call `context.present` in order
    // to show what's been drawn to the canvas.
    if ('present' in this.context) {
      (this.context.present as () => void)();
    }
  }

  updateViewport(width: number, height: number) {
    this.#viewport.resize(width, height);
    this.#updateProjection();
  }

  setPOV(transform: Transform, config: OrthographicConfig | PerspectiveConfig) {
    const rotation = mat4.fromQuat(transform.rotation);
    const forward = mat4.mul(rotation, vec4f(0, 0, -1, 0), vec4f());
    const up = mat4.mul(rotation, vec4f(0, 1, 0, 0), vec4f());

    mat4.identity(this.#matrices.view);
    mat4.lookAt(
      transform.position,
      add(transform.position, forward.xyz),
      up.xyz,
      this.#matrices.view,
    );
    mat4.invert(this.#matrices.view, this.#matrices.invView);

    this.#cameraConfig = config;
    this.#updateProjection();
  }

  addObject(object: GameObject) {
    this.#objects.push(object);
  }

  removeObject(id: number) {
    this.#objects = this.#objects.filter((obj) => obj.id !== id);
  }
}
