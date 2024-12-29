import tgpu from 'typegpu/experimental';
import { builtin, vec2f, vec4f } from 'typegpu/data';

const root = await tgpu.init();
const device = root.device;

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
    out.pos = vec4f(pos[idx], 0.0, 1.0);
    out.uv = uv[idx];
    return out;
  }`);

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

  const renderPipeline = root
    .withVertex(vertexFn, {})
    .withFragment(fragmentFn, { color: { format: presentationFormat } })
    .withPrimitive({ topology: 'triangle-strip' })
    .createPipeline();

  renderPipeline
    .withColorAttachment({
      color: {
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
      },
    })
    .draw(4);

  root.flush();
}
