import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { VectorStore } from './vector-store';
import { SimilarityService } from './similarity';

describe('VectorStore', () => {
  let service: VectorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(VectorStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('database name resolution', () => {
    const openedStores: VectorStore[] = [];

    afterEach(async () => {
      // Close every connection opened during the test before deleting the
      // databases, otherwise deleteDatabase() hangs waiting for them to close.
      for (const store of openedStores) {
        (store as any).db?.close();
      }
      openedStores.length = 0;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('takere-db');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('vector-store-spec-custom-db');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    });

    it('uses takere-db when no token is provided and no explicit argument is passed', async () => {
      openedStores.push(service);
      await service.initialize();
      const count = await service.getChunkCount();
      expect(count).toBe(0);
    });

    it('uses the explicit initialize() argument when provided, overriding the default', async () => {
      openedStores.push(service);
      await service.initialize('vector-store-spec-custom-db');
      await service.addChunk({ id: 'a', text: 'hello', embedding: [1, 0, 0] } as any);
      const count = await service.getChunkCount();
      expect(count).toBe(1);
    });

    it('isolates two instances configured with different effective database names', async () => {
      const similarity = TestBed.inject(SimilarityService);
      const isolatedStore = new VectorStore(similarity, 'vector-store-spec-custom-db');
      openedStores.push(service, isolatedStore);

      await isolatedStore.initialize();
      await isolatedStore.addChunk({ id: 'iso-1', text: 'isolated', embedding: [0, 1, 0] } as any);

      await service.initialize();
      const chatCount = await service.getChunkCount();

      expect(chatCount).toBe(0);
      const isolatedCount = await isolatedStore.getChunkCount();
      expect(isolatedCount).toBe(1);
    });
  });
});
