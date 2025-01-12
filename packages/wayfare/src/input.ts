// export function cleanupOneShotInputs() {}

const pressedKeyCodes = new Set<string>();

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

export const Input = {
  isKeyDown(key: string) {
    return pressedKeyCodes.has(key);
  },
};
