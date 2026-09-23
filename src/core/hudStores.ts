// src/core/hudStores.ts
// Shared external stores — writer is inside R3F, readers are React DOM.
// Same pattern as the original CameraHUD store, generalized.

type Store<T> = {
  value: T;
  listeners: Set<(v: T) => void>;
  set(v: T): void;
  subscribe(fn: (v: T) => void): () => void;
};

function createStore<T>(initial: T): Store<T> {
  return {
    value: initial,
    listeners: new Set(),
    set(v: T) {
      this.value = v;
      this.listeners.forEach((fn) => fn(v));
    },
    subscribe(fn) {
      this.listeners.add(fn);
      return () => {
        this.listeners.delete(fn);
      };
    },
  };
}

export const altitudeStore = createStore<number>(0);

/** Heading in degrees: 0 = north, 90 = east, increases clockwise. */
export const headingStore = createStore<number>(0);

export interface CursorInfo {
  active: boolean;
  x: number;
  z: number;
  elevation: number;
  lon: number;
  lat: number;
  slopeDeg: number;
}

export const cursorStore = createStore<CursorInfo>({
  active: false,
  x: 0,
  z: 0,
  elevation: 0,
  lon: 0,
  lat: 0,
  slopeDeg: 0,
});