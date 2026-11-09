import type { Store } from '@reduxjs/toolkit';

let _store: Store | null = null;

export function setStore(store: Store) {
  _store = store;
}

export function getStore(): Store {
  if (!_store) {
    throw new Error('Store not initialized yet');
  }
  return _store;
}
