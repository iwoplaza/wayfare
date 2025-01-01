import {
  type Vec4f,
  builtin,
  type m4x4f,
  mat4x4f,
  struct,
  vec2f,
  vec3f,
  vec4f,
} from 'typegpu/data';
import tgpu, {
  type ExperimentalTgpuRoot,
  type TgpuBindGroup,
  type TgpuBuffer,
  type TgpuRenderPipeline,
  type Uniform,
} from 'typegpu/experimental';
import { add } from 'typegpu/std';
import { mat4 } from 'wgpu-matrix';

import { Viewport } from './viewport.ts';
import { vertexLayout, type Mesh } from '../mesh.ts';
import type { Transform } from '../transform.ts';
import type { PerspectiveConfig } from '../camera-traits.ts';

const UniformsStruct = struct({
  modelMat: mat4x4f,
  normalModelMat: mat4x4f,
}).$name('Uniforms');

const POVStruct = struct({
  viewProjMat: mat4x4f,
}).$name('POV');

const sharedBindGroupLayout = tgpu
  .bindGroupLayout({
    pov: { uniform: POVStruct },
  })
  .$name('shared');

const uniformsBindGroupLayout = tgpu
  .bindGroupLayout({
    uniforms: { uniform: UniformsStruct },
  })
  .$name('uniforms');

type UniformsBindGroup = TgpuBindGroup<
  (typeof uniformsBindGroupLayout)['entries']
>;

const vertexFn = tgpu
  .vertexFn(
    { idx: builtin.vertexIndex, pos: vec3f, normal: vec3f, uv: vec2f },
    { pos: builtin.position, normal: vec3f, uv: vec2f },
  )
  .does(`(
    @builtin(vertex_index) idx: u32,
    @location(0) pos: vec3f,
    @location(1) normal: vec3f,
    @location(2) uv: vec2f
  ) -> Output {
    var out: Output;
    out.pos = pov.viewProjMat * uniforms.modelMat * vec4f(pos, 1.0);
    out.normal = (uniforms.normalModelMat * vec4f(normal, 0.0)).xyz;
    out.uv = uv;
    return out;
  }`)
  .$uses({
    uniforms: uniformsBindGroupLayout.bound.uniforms,
    pov: sharedBindGroupLayout.bound.pov,
  });

const fragmentFn = tgpu
  .fragmentFn({}, vec4f)
  .does(`(@location(0) normal: vec3f, @location(1) uv: vec2f) -> @location(0) vec4f {
    let ambient = vec3f(0.1, 0.15, 0.2);
    let diffuse = vec3f(1.0, 0.9, 0.7);
    let att = max(0., dot(normalize(normal), vec3f(0., 1., 0.)));
    let albedo = vec3f(1., 1., 1.);
    return vec4f((ambient + diffuse * att) * albedo, 1.0);
  }`);

export type GameObject = {
  id: number;
  mesh: Mesh;
  transform: Transform;
};

type ObjectResources = {
  uniformsBindGroup: UniformsBindGroup;
  uniformsBuffer: TgpuBuffer<typeof UniformsStruct> & Uniform;
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
  private readonly _context: GPUCanvasContext;
  private readonly _povBuffer: TgpuBuffer<typeof POVStruct> & Uniform;
  private readonly _renderPipeline: TgpuRenderPipeline<Vec4f>;
  private readonly _cachedResources = new Map<number, ObjectResources>();
  private _cameraConfig: PerspectiveConfig | null = null;

  constructor(
    public readonly root: ExperimentalTgpuRoot,
    public readonly canvas: HTMLCanvasElement,
  ) {
    const device = root.device;

    this._context = canvas.getContext('webgpu') as GPUCanvasContext;
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    this._context.configure({
      device: device,
      format: presentationFormat,
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

    // Listen to changes in window size and resize the canvas
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      this._viewport.resize(canvas.width, canvas.height);
      this._updateProjection();
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const sharedBindGroup = root.createBindGroup(sharedBindGroupLayout, {
      pov: this._povBuffer,
    });

    this._renderPipeline = root
      .withVertex(vertexFn, {
        pos: vertexLayout.attrib.position,
        normal: vertexLayout.attrib.normal,
        uv: vertexLayout.attrib.uv,
      })
      .withFragment(fragmentFn, { format: presentationFormat })
      .withPrimitive({ topology: 'triangle-list' })
      .withDepthStencil({
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      })
      .createPipeline()
      .with(sharedBindGroupLayout, sharedBindGroup);
  }

  private _updateProjection() {
    mat4.perspective(
      (45 / 180) * Math.PI, // fov
      this.canvas.width / this.canvas.height, // aspect
      0.1, // near
      1000.0, // far
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

  private _resourcesFor(id: number): ObjectResources {
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

      resources = { uniformsBindGroup, uniformsBuffer };
      this._cachedResources.set(id, resources);
    }

    return resources;
  }

  private _recomputeUniformsFor(id: number, transform: Transform) {
    const { uniformsBuffer } = this._resourcesFor(id);

    const model = this._matrices.model;
    mat4.identity(model);

    mat4.scale(model, transform.scale, model);
    mat4.translate(model, transform.position, model);
    mat4.multiply(model, mat4.fromQuat(transform.rotation), model);

    mat4.invert(model, this._matrices.normalModel);
    mat4.transpose(this._matrices.normalModel, this._matrices.normalModel);

    uniformsBuffer.write({
      modelMat: this._matrices.model,
      normalModelMat: this._matrices.normalModel,
    });
  }

  private _latestUniformsFor(id: number) {
    return this._resourcesFor(id).uniformsBindGroup;
  }

  render() {
    this._updatePOV();

    for (const { id, transform } of this._objects) {
      this._recomputeUniformsFor(id, transform);
    }

    this._renderPipeline
      .withColorAttachment({
        view: this._context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      })
      .withDepthStencilAttachment({
        view: this._viewport.depthTextureView,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0,
      })
      .beginPass((pass) => {
        for (const { id, mesh } of this._objects) {
          const bindGroup = this._latestUniformsFor(id);

          pass.setBindGroup(uniformsBindGroupLayout, bindGroup);
          pass.setVertexBuffer(vertexLayout, mesh.vertexBuffer);
          pass.draw(mesh.vertexCount);
        }
      });

    this.root.flush();
  }

  setPerspectivePOV(transform: Transform, config: PerspectiveConfig) {
    const rotation = mat4.fromQuat(transform.rotation);
    console.log(transform.rotation);
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
