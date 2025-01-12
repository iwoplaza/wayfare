import { Engine, Renderer } from 'wayfare';
import tgpu from 'typegpu/experimental';

import { createMap } from './map';
import { createAirParticles } from './air-particles';
import { createDudes } from './dude';
import { createPlayers } from './player';
import { createGameCamera } from './game-camera';

// Preloading...
const loadingScreen = document.getElementById('loading-screen');

if (loadingScreen) {
  loadingScreen.style.display = 'none';
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new Renderer(root, canvas);

  const engine = new Engine(root, renderer);
  const world = engine.world;

  const MapStuff = createMap(world);
  const AirParticles = createAirParticles(world, root);
  const Dudes = createDudes(world);
  const Players = createPlayers(world);
  const GameCamera = createGameCamera(world);

  engine.run(() => {
    Dudes.update();
    Players.update();
    MapStuff.update();
    AirParticles.update();
    GameCamera.update();
  });
}
