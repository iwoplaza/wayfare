// export function cleanupOneShotInputs() {}

const pressedKeyCodes = new Set<string>();

window.addEventListener('keydown', (e) => {
  pressedKeyCodes.add(e.code);
});

window.addEventListener('keyup', (e) => {
  pressedKeyCodes.delete(e.code);
});

export const Input = {
  isKeyDown(key: string) {
    return pressedKeyCodes.has(key);
  },
};
