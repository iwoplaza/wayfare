import type * as d from 'typegpu/data';
import type { KeyCode } from 'keyboardevent-codes';
import type { Default, Prettify } from './utility-types.js';

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

type BindingCatalog = {
  linear: KeyBinding;
  xy: DirectionalKeyBinding | TouchJoystickBinding;
};

type ControlType = keyof BindingCatalog;

interface ControlDef<TControlType extends ControlType = ControlType> {
  type?: ControlType | undefined;
  bindings: BindingCatalog[TControlType][];
}

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
  return null as unknown as InputMap<TControlDefs>;
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
