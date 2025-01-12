import { trait, type World } from 'koota';
import { Input, TransformTrait, Velocity } from 'wayfare';
import { vec3f } from 'typegpu/data';
import { length, normalize } from 'typegpu/std';

import { MapProgressMarker } from './map';
import { Dude, DudeBundle } from './dude';

export const Player = trait({
  upKey: 'KeyW',
  downKey: 'KeyS',
  leftKey: 'KeyA',
  rightKey: 'KeyD',
});

function controlPlayerSystem(world: World) {
  world.query(Player, Dude).updateEach(([player, dude]) => {
    let dir = vec3f();

    if (Input.isKeyDown(player.upKey)) {
      dir.z = -1;
    } else if (Input.isKeyDown(player.downKey)) {
      dir.z = 1;
    } else {
      dir.z = 0;
    }

    if (Input.isKeyDown(player.leftKey)) {
      dir.x = -1;
    } else if (Input.isKeyDown(player.rightKey)) {
      dir.x = 1;
    } else {
      dir.x = 0;
    }

    if (length(dir) > 1) {
      dir = normalize(dir);
    }

    // Encroaching the movement direction
    dude.movementDir.x = dir.x;
    dude.movementDir.y = dir.y;
    dude.movementDir.z = dir.z;
  });
}

export function createPlayers(world: World) {
  world.spawn(
    Player,
    ...DudeBundle(),
    MapProgressMarker,
    TransformTrait({
      position: vec3f(0, 0, 0),
      scale: vec3f(0.1),
    }),
    Velocity(vec3f(0, -5, 0)),
  );

  return {
    update() {
      controlPlayerSystem(world);
    },
  };
}
