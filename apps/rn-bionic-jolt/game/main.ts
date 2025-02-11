import { Engine, Renderer } from 'wayfare';
import { createDudes } from './dude';
import tgpu from 'typegpu';
import { PixelRatio } from 'react-native';
import { createMap } from './map';
import { createAirParticles } from './air-particles';
import { createPlayers } from './player';
import { createGameCamera } from './game-camera';

export function setupGame(
  canvas: HTMLCanvasElement,
  context: GPUCanvasContext,
) {
  let destroyed = false;
  let engine: Engine | undefined;

  (async () => {
    const root = await tgpu.init();

    if (destroyed) {
      return;
    }

    const renderer = new Renderer(root, canvas, context);
    engine = new Engine(root, renderer);
    const world = engine.world;

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

    // const Audio = createAudio(world);
    const MapStuff = createMap(world);
    const AirParticles = createAirParticles(world, root);
    const Dudes = createDudes(world);
    const Players = createPlayers(world);
    const GameCamera = createGameCamera(world);

    Players.init();

    engine.run(() => {
      // Updating viewport
      const newWidth = canvas.clientWidth * PixelRatio.get();
      const newHeight = canvas.clientHeight * PixelRatio.get();
      if (newWidth !== prevCanvasWidth || newHeight !== prevCanvasHeight) {
        prevCanvasWidth = newWidth;
        prevCanvasHeight = newHeight;
        updateViewport();
      }

      // Audio.update();
      Dudes.update();
      Players.update();
      MapStuff.update();
      AirParticles.update();
      GameCamera.update();
    });
  })();

  return () => {
    destroyed = true;
    if (engine) {
      engine.destroy();
    }
  };
}
