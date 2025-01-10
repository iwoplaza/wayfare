import type { Entity, Trait, TraitInstance, World } from 'koota';

export function getOrAdd<T extends Trait>(
  entity: Entity | World,
  trait: T,
): TraitInstance<T> {
  if (!entity.has(trait)) {
    entity.add(trait);
  }
  return entity.get(trait) as TraitInstance<T>;
}

export function getOrThrow<T extends Trait>(
  entity: Entity | World,
  trait: T,
): TraitInstance<T> {
  const value = entity.get(trait);
  if (!value) {
    throw new Error(`Entity ${entity} does not have trait ${trait}`);
  }
  return value;
}
