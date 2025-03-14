import tgpu from 'typegpu';
import * as wayfare from 'wayfare';

// These imports are preloading the necessary assets
// TODO: Hopefully the VM is smart enough to parallelize these, but
//       better to test this anyway.
import { createAirParticles } from './air-particles.js';
import { createDudes } from './dude.js';
import { createGameCamera } from './game-camera.js';
import { createMap } from './map.js';
import { createPlayers } from './player.js';
import { createJoystick } from './joystick.js';
import { createAudio } from './audio.js';

const loadingScreen = document.getElementById('loading-screen') as HTMLElement;
const mainMenu = document.getElementById('main-menu') as HTMLElement;
const fallBtn = document.getElementById('fall-btn') as HTMLElement;

if (loadingScreen) {
  loadingScreen.style.display = 'none';
  mainMenu.style.display = 'flex';
}

export async function main(canvas: HTMLCanvasElement) {
  const root = await tgpu.init();
  const renderer = new wayfare.Renderer(
    root,
    canvas,
    canvas.getContext('webgpu') as GPUCanvasContext,
  );
  const engine = new wayfare.Engine(root, renderer);
  const world = engine.world;

  // Listen to changes in window size and resize the canvas
  const handleResize = () => {
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const devicePixelRatio = window.devicePixelRatio;
    const width = window.innerWidth * devicePixelRatio;
    const height = window.innerHeight * devicePixelRatio;
    canvas.width = width;
    canvas.height = height;
    renderer.updateViewport(width, height);
  };
  handleResize();
  window.addEventListener('resize', handleResize);

  createJoystick();

  const Audio = createAudio(world);
  const MapStuff = createMap(world);
  const AirParticles = createAirParticles(world, root);
  const Dudes = createDudes(world);
  const Players = createPlayers(world);
  const GameCamera = createGameCamera(world);

  fallBtn.addEventListener('click', () => {
    mainMenu.style.display = 'none';

    Audio.tryResume();
    Players.init();
  });

  engine.run(() => {
    Audio.update();
    Dudes.update();
    Players.update();
    MapStuff.update();
    AirParticles.update();
    GameCamera.update();
  });
}
