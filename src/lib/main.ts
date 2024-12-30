import tgpu, { type ExperimentalTgpuRoot } from 'typegpu/experimental';
import {
  builtin,
  looseArrayOf,
  looseStruct,
  mat4x4f,
  struct,
  vec2f,
  vec3f,
  vec4f,
} from 'typegpu/data';
import { mat4 } from 'wgpu-matrix';
import { load } from '@loaders.gl/core';
import { OBJLoader } from '@loaders.gl/obj';

import susannePath from '../assets/susanne.obj?url';
import { Viewport } from './viewport';

const vertexLayout = tgpu.vertexLayout((n) =>
  looseArrayOf(looseStruct({ position: vec3f, normal: vec3f, uv: vec2f }), n),
);

const Uniforms = struct({
  viewProjMat: mat4x4f,
  modelMat: mat4x4f,
  normalModelMat: mat4x4f,
}).$name('Uniforms');

const uniformsLayout = tgpu
  .bindGroupLayout({
    uniforms: { uniform: Uniforms },
  })
  .$name('uniforms');

const { uniforms } = uniformsLayout.bound;

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
    out.pos = uniforms.viewProjMat * uniforms.modelMat * vec4f(pos, 1.0);
    out.normal = (uniforms.normalModelMat * vec4f(normal, 0.0)).xyz;
    out.uv = uv;
    return out;
  }`)
  .$uses({ uniforms });

const fragmentFn = tgpu
  .fragmentFn({}, vec4f)
  .does(`(@location(0) normal: vec3f, @location(1) uv: vec2f) -> @location(0) vec4f {
    let ambient = vec3f(0.1, 0.15, 0.2);
    let diffuse = vec3f(1.0, 0.9, 0.7);
    let att = max(0., dot(normalize(normal), vec3f(0., 1., 0.)));
    let albedo = vec3f(1., 1., 1.);
    return vec4f((ambient + diffuse * att) * albedo, 1.0);
  }`);

export async function loadSusanne(root: ExperimentalTgpuRoot) {
  const susanneModel = await load(susannePath, OBJLoader);
  console.log(susanneModel);

  const POSITION = susanneModel.attributes.POSITION.value;
  const NORMAL = susanneModel.attributes.NORMAL.value;
  const TEXCOORD_0 = susanneModel.attributes.TEXCOORD_0.value;
  const vertexCount = POSITION.length / 3;

  const susanneVertexBuffer = root
    .createBuffer(
      vertexLayout.schemaForCount(vertexCount),
      Array.from({ length: vertexCount }, (_, i) => ({
        position: vec3f(
          POSITION[i * 3],
          POSITION[i * 3 + 1],
          POSITION[i * 3 + 2],
        ),
        normal: vec3f(NORMAL[i * 3], NORMAL[i * 3 + 1], NORMAL[i * 3 + 2]),
        uv: vec2f(TEXCOORD_0[i * 2], TEXCOORD_0[i * 2 + 1]),
      })),
    )
    .$usage('vertex');

  return { vertexCount, buffer: susanneVertexBuffer };
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const device = root.device;

  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  const viewport = new Viewport(root, canvas.width, canvas.height);

  // --- Load the model ---
  const susanne = await loadSusanne(root);
  // -----------------------

  const matrices = {
    proj: mat4.identity(mat4x4f()),
    view: mat4.identity(mat4x4f()),
    model: mat4.identity(mat4x4f()),
    normalModel: mat4.identity(mat4x4f()),
  };

  const uniformsBuffer = root
    .createBuffer(Uniforms, {
      viewProjMat: mat4.identity(mat4x4f()),
      modelMat: mat4.identity(mat4x4f()),
      normalModelMat: mat4.identity(mat4x4f()),
    })
    .$usage('uniform');

  function updateProjection() {
    mat4.perspective(
      (45 / 180) * Math.PI, // fov
      canvas.width / canvas.height, // aspect
      0.1, // near
      1000.0, // far
      matrices.proj,
    );
  }

  function updateUniforms() {
    uniformsBuffer.write({
      viewProjMat: matrices.proj,
      modelMat: matrices.model,
      normalModelMat: matrices.normalModel,
    });
  }

  // Listen to changes in window size and resize the canvas
  function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    viewport.resize(canvas.width, canvas.height);
    updateProjection();
  }
  handleResize();
  window.addEventListener('resize', handleResize);

  function updateModel() {
    const model = matrices.model;
    mat4.identity(model);
    mat4.scale(model, [10, 10, 10], model);
    mat4.translate(model, [0, 0, -10], model);
    mat4.rotate(model, [0, 1, 0], Date.now() / 1000, model);

    mat4.invert(model, matrices.normalModel);
    mat4.transpose(matrices.normalModel, matrices.normalModel);
  }

  const uniformsBindGroup = root.createBindGroup(uniformsLayout, {
    uniforms: uniformsBuffer,
  });

  const renderPipeline = root
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
    .createPipeline();

  function render() {
    updateModel();
    updateUniforms();

    renderPipeline
      .with(uniformsLayout, uniformsBindGroup)
      .with(vertexLayout, susanne.buffer)
      .withColorAttachment({
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      })
      .withDepthStencilAttachment({
        view: viewport.depthTextureView,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0,
      })
      .draw(susanne.vertexCount);

    root.flush();

    requestAnimationFrame(render);
  }

  render();
}
