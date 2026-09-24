import { useSyncExternalStore } from 'react'
/** Minimal external store so only subscribed components rerender on telemetry ticks. */
export interface Store<T> {
  get(): T
  set(patch: Partial<T>): void
  subscribe(listener: () => void): () => void
}
export function createStore<T extends object>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(patch) {
      value = { ...value, ...patch }
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
/** Selectors must return primitives or existing references. */
export const useStore = <T, S>(store: Store<T>, select: (value: T) => S): S =>
  useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get())
  )
