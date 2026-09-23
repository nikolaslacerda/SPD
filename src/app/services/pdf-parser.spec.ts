import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PdfParser } from './pdf-parser';

describe('PdfParser', () => {
  let service: PdfParser;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(PdfParser);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('parseFile chunk size', () => {
    const pageText = 'a'.repeat(1200);
    const fakeFile = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) } as unknown as File;

    beforeEach(() => {
      const fakePage = {
        getTextContent: () =>
          Promise.resolve({ items: [{ str: pageText }] })
      };
      const fakePdf = {
        numPages: 1,
        getPage: () => Promise.resolve(fakePage)
      };
      spyOn(service as any, 'loadDocument').and.returnValue(Promise.resolve(fakePdf));
    });

    it('produces ~500-char chunks by default when chunkSize is omitted', async () => {
      const chunks = await service.parseFile(fakeFile);

      expect(chunks.length).toBe(Math.ceil(pageText.length / 500));
      expect(chunks[0].text.length).toBe(500);
    });

    it('changes the number and length of chunks when a custom chunkSize is provided', async () => {
      const chunks = await service.parseFile(fakeFile, 300);

      expect(chunks.length).toBe(Math.ceil(pageText.length / 300));
      expect(chunks[0].text.length).toBe(300);
    });
  });
});
