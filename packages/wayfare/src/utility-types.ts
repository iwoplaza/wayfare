export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Default<T, TDefault> = unknown extends T
  ? TDefault
  : T extends undefined
    ? TDefault
    : T;
