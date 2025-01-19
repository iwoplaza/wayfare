// `structuredClone` is not yet available in Hermes
import structuredClone from '@ungap/structured-clone';
if (!('structuredClone' in globalThis)) {
  // biome-ignore lint/suspicious/noExplicitAny: <you know why>
  (globalThis as any).structuredClone = structuredClone;
}
