import type { Entity, ExtractSchema, Trait, TraitInstance, World } from 'koota';

export function getOrAdd<T extends Trait>(
  entity: Entity | World,
  trait: T,
): TraitInstance<ExtractSchema<T>> {
  if (!entity.has(trait)) {
    entity.add(trait);
  }
  return (entity as Entity).get(trait) as TraitInstance<ExtractSchema<T>>;
}

export function getOrThrow<T extends Trait>(entity: Entity | World, trait: T): TraitInstance<T> {
  const value = (entity as Entity).get(trait);
  if (!value) {
    throw new Error(`Entity ${entity} does not have trait ${trait}`);
  }
  return value;
}
