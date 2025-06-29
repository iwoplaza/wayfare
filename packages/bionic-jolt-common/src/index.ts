import type { TgpuRoot } from 'typegpu';
import * as wf from 'wayfare';
import { createAirParticles } from './air-particles.ts';
import { createAudio } from './audio.ts';
import { createDudes } from './dude.ts';
import { createGameCamera } from './game-camera.ts';
import { createMap } from './map.ts';
import { GameState, createPlayers } from './player.ts';

export { createAirParticles } from './air-particles.ts';
export { createAudio } from './audio.ts';
export { Dude, DudeBundle, createDudes } from './dude.ts';
export { createGameCamera } from './game-camera.ts';
export { Player, createPlayers } from './player.ts';
export { createMap } from './map.ts';

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
