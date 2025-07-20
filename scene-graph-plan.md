Design goals:
- Systems should be global
- Entities and components should be granular

```ts
import * as wf from 'wayfare';
import dudeFile from './assets/dude.js';

const dudeMesh = wf.meshAsset({ src: dudeFile });

// Just re-exported Koota traits
const Dude = wf.trait({
  freeFallHorizontalSpeed: 2,
  movementDir: () => vec3f(),
  smoothTurnDir: () => vec3f(),
});

const DudeBundle = () => [
  Dude,
  wf.Mesh(dudeMesh),
  ...wf.BlinnPhongMaterial({ albedo: vec3f(1, 1, 1) }),
];

const Player = wf.node((world) => {
  world.spawn(DudeBundle());

  return {
    onFrame() {
      
    },
  };
});
```