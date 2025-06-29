import type { TgpuRoot } from 'typegpu';
import * as wf from 'wayfare';
import { createAirParticles } from './air-particles.js';
import { createAudio } from './audio.js';
import { createDudes } from './dude.js';
import { createGameCamera } from './game-camera.js';
import { createMap } from './map.js';
import { GameState, createPlayers } from './player.js';

export { createAirParticles } from './air-particles.js';
export { createAudio } from './audio.js';
export { Dude, DudeBundle, createDudes } from './dude.js';
export { createGameCamera } from './game-camera.js';
export { Player, createPlayers } from './player.js';
export { createMap } from './map.js';

export function BionicJolt(
  root: TgpuRoot,
  canvas: HTMLCanvasElement,
  context: GPUCanvasContext,
) {
  const renderer = new wf.Renderer(root, canvas, context);
  const engine = new wf.Engine(root, renderer);
  const world = engine.world;

  const Audio = createAudio(world);
  const MapStuff = createMap(world);
  const AirParticles = createAirParticles(world, root);
  const Dudes = createDudes(world);
  const Players = createPlayers(world);
  const GameCamera = createGameCamera(world);

  return {
    renderer,
    engine,

    start() {
      Audio.tryResume();
      Players.init();
    },

    loop() {
      engine.run(() => {
        const gameState = wf.getOrAdd(world, GameState);

        Audio.update();
        Players.update();
        MapStuff.update();

        if (!gameState.isGameOver) {
          Dudes.update();
          AirParticles.update();
          GameCamera.update();
        }
      });
    },
  };
}
