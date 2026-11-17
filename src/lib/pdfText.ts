import { openPdf } from './pdfjs';

/** PDF 앞쪽 몇 쪽의 글자를 줄 단위로 읽어요. 스캔한 이미지 PDF면 빈 배열이 나와요. */
export async function pdfLines(blob: Blob, maxPages = 4): Promise<string[]> {
  const task = openPdf(new Uint8Array(await blob.arrayBuffer()));
  const doc = await task.promise;
  const out: string[] = [];
  for (let n = 1; n <= Math.min(maxPages, doc.numPages); n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    // 같은 높이(y)에 있는 글자 조각을 한 줄로 모아요
    const rows: { y: number; parts: { x: number; s: string; w: number }[] }[] = [];
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 3);
      if (!row) rows.push((row = { y, parts: [] }));
      row.parts.push({ x, s: it.str, w: it.width });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.parts.sort((a, b) => a.x - b.x);
      let line = '';
      let end = -Infinity;
      for (const p of r.parts) {
        line += (line && p.x - end > 2 ? ' ' : '') + p.s;
        end = p.x + p.w;
      }
      out.push(line);
    }
  }
  await task.destroy(); // 다 읽은 PDF는 메모리에서 내려요
  return out;
}
