import { relation } from 'koota';

export const ChildOf = relation({ exclusive: true, autoRemoveTarget: true });
export const ParentOf = relation({});
