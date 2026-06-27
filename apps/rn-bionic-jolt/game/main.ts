import { PixelRatio } from 'react-native';
import { AudioContext } from 'react-native-audio-api';
import { TgpuRoot } from 'typegpu';
import * as wf from 'wayfare';
import { BionicJolt } from 'bionic-jolt-common';

export function setupGame(signal: AbortSignal, root: TgpuRoot, ctx: GPUCanvasContext) {
  const canvas = ctx.canvas as HTMLCanvasElement;
  const { start, loop, engine, renderer } = BionicJolt(
    root,
    ctx,
    AudioContext as unknown as typeof globalThis.AudioContext,
  );

  let prevCanvasWidth = 0;
  let prevCanvasHeight = 0;

  function updateViewport() {
    prevCanvasWidth = canvas.clientWidth * PixelRatio.get();
    prevCanvasHeight = canvas.clientHeight * PixelRatio.get();
    canvas.width = prevCanvasWidth;
    canvas.height = prevCanvasHeight;
    renderer.updateViewport(prevCanvasWidth, prevCanvasHeight);
  }

  updateViewport();

  engine.renderSchedule.add(
    () => {
      // Updating viewport
      const newWidth = canvas.clientWidth * PixelRatio.get();
      const newHeight = canvas.clientHeight * PixelRatio.get();
      if (newWidth !== prevCanvasWidth || newHeight !== prevCanvasHeight) {
        prevCanvasWidth = newWidth;
        prevCanvasHeight = newHeight;
        updateViewport();
      }
    },
    { before: wf.RENDER_TIMESLOT },
  );

  start();
  loop();

  signal.addEventListener('abort', () => {
    if (engine) {
      engine.destroy();
    }
  });
}
