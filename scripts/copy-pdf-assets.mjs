// pdf.js가 한글 글꼴 정보(cmaps), 기본 글꼴, 이미지 해석기(wasm)를 읽을 수 있게 public 폴더로 복사해요.
// npm run dev / build 할 때 자동으로 실행돼요.
import { cpSync, existsSync } from 'node:fs';
for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
  const from = `node_modules/pdfjs-dist/${dir}`;
  if (existsSync(from)) cpSync(from, `public/pdfjs/${dir}`, { recursive: true });
}
