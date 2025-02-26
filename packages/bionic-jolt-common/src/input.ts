import { Input } from 'wayfare';

export const inputMap = Input.createMap({
  controls: {
    movement: {
      type: 'xy',
      bindings: [...Input.ArrowKeysPreset, ...Input.WASDPreset],
    },
  },
});
