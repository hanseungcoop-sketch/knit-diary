// 아이패드의 예전 사파리에서도 동작하도록 pdf.js의 legacy 빌드를 써요
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const base = (dir: string) => new URL(`pdfjs/${dir}/`, document.baseURI).href;

/** 한글 도안도 글자가 깨지지 않게 글꼴 정보 위치를 알려주고 PDF를 열어요 */
export const openPdf = (data: Uint8Array) =>
  pdfjs.getDocument({
    data,
    cMapUrl: base('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: base('standard_fonts'),
    wasmUrl: base('wasm')
  });

export type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
