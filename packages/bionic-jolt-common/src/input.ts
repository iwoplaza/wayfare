import * as wf from 'wayfare';

export const inputMap = wf.Input.createMap({
  controls: {
    movement: {
      type: 'xy',
      bindings: [...wf.Input.ArrowKeysPreset, ...wf.Input.WASDPreset],
    },
    shoot: {
      type: 'linear',
      bindings: [{ key: 'Space' }],
    },
  },
});
