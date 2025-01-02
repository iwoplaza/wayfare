import type { Entity, Trait, TraitInstance, World } from 'koota';

export function getOrAdd<T extends Trait>(
  entity: Entity | World,
  trait: T,
): TraitInstance<T> {
  if (!entity.has(trait)) {
    entity.add(trait);
  }
  return entity.get(trait);
}
