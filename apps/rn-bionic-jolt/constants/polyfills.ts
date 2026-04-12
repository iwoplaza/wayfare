// `structuredClone` is not yet available in Hermes
import structuredClone from '@ungap/structured-clone';
if (!('structuredClone' in globalThis)) {
  (globalThis as any).structuredClone = structuredClone;
}
