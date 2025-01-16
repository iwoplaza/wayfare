import { type ExtractSchema, Not, type World, trait } from 'koota';
import { vec3f, vec4f } from 'typegpu/data';
import {
  BlinnPhongMaterial,
  MaterialTrait,
  MeshTrait,
  TransformTrait,
  getOrAdd,
  getOrThrow,
  meshAsset,
} from 'wayfare';
import { quat } from 'wgpu-matrix';

import pentagonPath from '../assets/pentagon.obj?url';
import { WindAudio } from './audio';
const pentagonMesh = await meshAsset({ url: pentagonPath }).preload();

/**
 * Settings given to a world.
 */
export const MapSettings = trait({
  farDistance: 100,
  deSpawnThreshold: 100,
});

/**
 * The entity who's position is used to determine the progress of the map.
 * Typically the player.
 */
export const MapProgressMarker = trait();

export const WindListener = trait();

export type MapChunk = ExtractSchema<typeof MapChunk>;
export const MapChunk = trait({
  length: 1,
});

/**
 * The chunk that's at end of the currently generated map.
 * Used to know where to append new chunks.
 */
export const MapTail = trait();

const WindAudioSource = trait();

function clamp01(x: number) {
  return Math.max(0, Math.min(x, 1));
}

export function createMap(world: World) {
  world.spawn(WindAudioSource, ...WindAudio.Bundle());

  function updateMapSystem() {
    const settings = getOrAdd(world, MapSettings);
    const progressMarker = world.queryFirst(MapProgressMarker);
    const progressMarkerPos = progressMarker?.get(TransformTrait)?.position;

    if (!progressMarkerPos) return;

    world
      .query(MapChunk, TransformTrait, Not(MapTail))
      .updateEach(([chunk, transform], entity) => {
        // Is well above the marker?
        if (
          transform.position.y - chunk.length >
          progressMarkerPos.y + settings.deSpawnThreshold
        ) {
          entity.destroy();
        }
      });

    // Handle highlighting when new the marker
    world
      .query(TransformTrait, BlinnPhongMaterial.Params, MaterialTrait, MapChunk)
      .updateEach(([transform, material]) => {
        const distance = Math.abs(progressMarkerPos.y - transform.position.y);
        if (distance < 0.2) {
          material.albedo = vec3f(1, 1, 0);
        } else {
          material.albedo = vec3f(1, 0.5, 0);
        }
      });

    // Add new chunks
    let limit = 10;
    do {
      const tail = world.queryFirst(MapTail);
      const tailPosition = tail?.get(TransformTrait)?.position;
      const tailChunk = tail?.get(MapChunk);

      if (
        !tail ||
        !tailPosition ||
        tailPosition.y > progressMarkerPos.y - settings.farDistance
      ) {
        const xPos = (tailPosition?.x ?? 0) + (Math.random() * 2 - 1) * 0.4;
        const yPos = (tailPosition?.y ?? -10) - (tailChunk?.length ?? 0);
        const zPos = (tailPosition?.z ?? 0) + (Math.random() * 2 - 1) * 0.4;

        world.spawn(
          MapChunk({ length: 1 + Math.random() * 5 }),
          TransformTrait({
            position: vec3f(xPos, yPos, zPos),
            rotation: quat.fromEuler(
              0,
              Math.random() * Math.PI,
              0,
              'xyz',
              vec4f(),
            ),
          }),
          MeshTrait(pentagonMesh),
          MapTail,
          ...BlinnPhongMaterial.Bundle(),
        );
        tail?.remove(MapTail);
      } else {
        break;
      }

      limit--;
    } while (limit > 0);
  }

  return {
    update() {
      updateMapSystem();

      const listenerY = getOrThrow(
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        world.queryFirst(WindListener)!,
        TransformTrait,
      ).position.y;

      const minDist = world.query(MapChunk).reduce((acc, chunk) => {
        const chunkY = getOrThrow(chunk, TransformTrait).position.y;
        return Math.min(acc, Math.abs(chunkY - listenerY));
      }, Number.POSITIVE_INFINITY);

      if (minDist < Number.POSITIVE_INFINITY) {
        world
          .query(WindAudio.Params, WindAudioSource)
          .updateEach(([params]) => {
            const clamped1 = clamp01(1 - minDist * 0.5);

            params.gainNode.gain.value = 0.2 + clamped1 ** 3 * 0.8;
            params.highPass.frequency.value = 1000 - clamped1 ** 0.5 * 1000;
          });
      }
    },
  };
}
