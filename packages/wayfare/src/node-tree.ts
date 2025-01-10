import { type Entity, relation } from 'koota';

export const ChildOf = relation({ exclusive: true, autoRemoveTarget: true });
export const ParentOf = relation({});

export function connectAsChild(parent: Entity, child: Entity) {
  child.add(ChildOf(parent));
  parent.add(ParentOf(child));
}
