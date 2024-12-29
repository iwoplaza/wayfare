import tgpu from 'typegpu/experimental';
import { builtin, mat4x4f, vec2f, vec4f } from 'typegpu/data';
import { mat4 } from 'wgpu-matrix';

const root = await tgpu.init();
const device = root.device;

const uniformsLayout = tgpu
  .bindGroupLayout({
    projMat: { uniform: mat4x4f },
    viewMat: { uniform: mat4x4f },
    worldMat: { uniform: mat4x4f },
  })
  .$name('uniforms');

const { projMat, viewMat, worldMat } = uniformsLayout.bound;

const vertexFn = tgpu
  .vertexFn({ idx: builtin.vertexIndex }, { pos: builtin.position, uv: vec2f })
  .does(`(@builtin(vertex_index) idx: u32) -> Output {
    var pos = array<vec2f, 4>(
      vec2(1, 1), // top-right
      vec2(-1, 1), // top-left
      vec2(1, -1), // bottom-right
      vec2(-1, -1) // bottom-left
    );
    var uv = array<vec2f, 4>(
      vec2(1., 1.), // top-right
      vec2(0., 1.), // top-left
      vec2(1., 0.), // bottom-right
      vec2(0., 0.) // bottom-left
    );
    var out: Output;
    out.pos = projMat * viewMat * modelMat * vec4f(pos[idx], 0.0, 1.0);
    out.uv = uv[idx];
    return out;
  }`)
  .$uses({ projMat, viewMat, modelMat: worldMat });

const fragmentFn = tgpu
  .fragmentFn({}, { color: vec4f })
  .does(`(@location(0) uv: vec2f) -> @location(0) vec4f {
    if (uv.x < 0.5 && uv.y < 0.5) {
      return vec4f(0.0, uv.x, uv.y, 1.0);
    } else {
      return vec4f(1.0, 0., 0., 1.0);
    }
  }`);

export function main(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device: device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  // Listen to changes in window size and resize the canvas
  function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  handleResize();
  window.addEventListener('resize', handleResize);

  const projMatBuffer = root
    .createBuffer(mat4x4f, mat4.identity(mat4x4f()))
    .$usage('uniform');

  function updateProjection() {
    const proj = mat4.perspective(
      (45 / 180) * Math.PI, // fov
      canvas.width / canvas.height, // aspect
      0.1, // near
      1000.0, // far
      mat4x4f(),
    );

    projMatBuffer.write(proj);
  }

  updateProjection();

  const viewMatBuffer = root
    .createBuffer(mat4x4f, mat4.identity(mat4x4f()))
    .$usage('uniform');

  const worldMatBuffer = root
    .createBuffer(mat4x4f, mat4.identity(mat4x4f()))
    .$usage('uniform');

  function updateWorld() {
    const world = mat4.identity(mat4x4f());
    mat4.scale(world, [10, 10, 10], world);
    mat4.translate(world, [0, 0, -10], world);
    mat4.rotate(world, [0, 1, 0], Date.now() / 1000, world);

    worldMatBuffer.write(world);
  }

  const uniformsBindGroup = root.createBindGroup(uniformsLayout, {
    projMat: projMatBuffer,
    viewMat: viewMatBuffer,
    worldMat: worldMatBuffer,
  });

  const renderPipeline = root
    .withVertex(vertexFn, {})
    .withFragment(fragmentFn, { color: { format: presentationFormat } })
    .withPrimitive({ topology: 'triangle-strip' })
    .createPipeline();

  function render() {
    updateWorld();

    renderPipeline
      .with(uniformsLayout, uniformsBindGroup)
      .withColorAttachment({
        color: {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      })
      .draw(4);

    root.flush();

    requestAnimationFrame(render);
  }

  render();
}
