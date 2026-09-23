import { InjectionToken } from '@angular/core';

/**
 * Overrides the IndexedDB database name a component-scoped `VectorStore` instance
 * resolves to (research.md #11). Not provided at the root injector, so the chat's
 * singleton `VectorStore` keeps using its `'takere-db'` default.
 */
export const VECTOR_STORE_DB_NAME = new InjectionToken<string>('VECTOR_STORE_DB_NAME');
