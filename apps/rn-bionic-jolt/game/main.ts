import { PixelRatio } from 'react-native';
import { TgpuRoot } from 'typegpu';
import { Engine, Renderer } from 'wayfare';
import { createAirParticles } from 'bionic-jolt-common/air-particles';
import { createDudes } from './dude';
import { createGameCamera } from './game-camera';
import { createMap } from './map';
import { createPlayers } from './player';

export function setupGame(signal: AbortSignal, root: TgpuRoot, ctx: GPUCanvasContext) {
  let engine: Engine | undefined;
  const canvas = ctx.canvas as HTMLCanvasElement;

  const renderer = new Renderer(root, canvas, ctx);
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

  signal.addEventListener('abort', () => {
    if (engine) {
      engine.destroy();
    }
  });
}
