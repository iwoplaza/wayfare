import type { KeyCode } from 'keyboardevent-codes';
import * as d from 'typegpu/data';
import * as std from 'typegpu/std';
import type { Default, Prettify } from './utility-types.ts';

interface KeyBinding {
  key: KeyCode;
}

interface TouchJoystickBinding {
  touchJoystick: Record<string, never>;
}

interface DirectionalKeyBinding {
  key: KeyCode;
  dir: readonly [number, number];
}

type ControlDefCatalog = {
  linear: { type: 'linear'; bindings: KeyBinding[] };
  xy: {
    type: 'xy';
    bindings: (DirectionalKeyBinding | TouchJoystickBinding)[];
  };
};

type ControlType = keyof ControlDefCatalog;
type ControlDef = ControlDefCatalog[ControlType];
type ControlDefs = Record<string, ControlDef>;

interface CreateInputOptions<TControlDefs extends ControlDefs> {
  controls: TControlDefs;
}

interface LinearState {
  /**
   * Equivalent to checking if `.value > 0`.
   */
  readonly isActive: boolean;
  readonly value: number;
  // readonly justActivated: boolean;
}

interface XYState {
  readonly value: d.v2f;
}

type StateCatalog = {
  linear: LinearState;
  xy: XYState;
};

type StateForDef<TDef extends ControlDef> = StateCatalog[Default<
  TDef['type'],
  'linear'
>];

type InputMap<TControlDefs extends ControlDefs> = {
  readonly [K in keyof TControlDefs]: StateForDef<TControlDefs[K]>;
};

const pressedKeyCodes = new Set<string>();

function captureWebEvents() {
  window.addEventListener('keydown', (e) => {
    pressedKeyCodes.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    pressedKeyCodes.delete(e.code);
  });

  // Locking the zoom behavior on mobile.
  document.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault();
    },
    { passive: false },
  );
}

if (
  // Are we running on the web?
  typeof window !== 'undefined' &&
  typeof window.addEventListener !== 'undefined'
) {
  captureWebEvents();
}

const ArrowKeysPreset: DirectionalKeyBinding[] = [
  { key: 'ArrowLeft', dir: [-1, 0] },
  { key: 'ArrowRight', dir: [1, 0] },
  { key: 'ArrowDown', dir: [0, -1] },
  { key: 'ArrowUp', dir: [0, 1] },
];

const WASDPreset: DirectionalKeyBinding[] = [
  { key: 'KeyA', dir: [-1, 0] },
  { key: 'KeyD', dir: [1, 0] },
  { key: 'KeyS', dir: [0, -1] },
  { key: 'KeyW', dir: [0, 1] },
];

function createMap<TControlDefs extends ControlDefs>(
  options: CreateInputOptions<TControlDefs>,
): Prettify<InputMap<TControlDefs>> {
  // ...

  return Object.fromEntries(
    Object.entries(options.controls).map(([key, def]) => {
      if (def.type === 'linear') {
        const state = {
          get value() {
            return def.bindings.reduce((acc, binding) => {
              if ('key' in binding) {
                return Math.max(acc, pressedKeyCodes.has(binding.key) ? 1 : 0);
              }

              throw new Error('Invalid input binding');
            }, 0);
          },
          get isActive() {
            return this.value > 0;
          },
        } satisfies LinearState;

        return [key, state] as const;
      }

      if (def.type === 'xy') {
        const state = {
          get value(): d.v2f {
            return def.bindings.reduce((acc, binding) => {
              if ('key' in binding) {
                if (pressedKeyCodes.has(binding.key)) {
                  return std.add(acc, d.vec2f(...binding.dir));
                }

                return acc;
              }

              throw new Error('Invalid input binding');
            }, d.vec2f());
          },
        } satisfies XYState;

        return [key, state] as const;
      }

      def satisfies never;
      throw new Error('Invalid input map definition.');
    }),
  ) as InputMap<TControlDefs>;
}

/**
 * @deprecated
 */
function isKeyDown(key: string) {
  return pressedKeyCodes.has(key);
}

export const Input = {
  ArrowKeysPreset,
  WASDPreset,

  createMap,
  isKeyDown,
};
