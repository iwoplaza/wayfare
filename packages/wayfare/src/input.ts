// export function cleanupOneShotInputs() {}

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

if (typeof window !== 'undefined') {
  captureWebEvents();
}

export const Input = {
  isKeyDown(key: string) {
    return pressedKeyCodes.has(key);
  },
};
