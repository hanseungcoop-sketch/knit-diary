import { PDFDocument } from 'pdf-lib';
import { loadImage } from './image';
import { THEMES, type Theme } from './themes';
import type { Photo, Project } from './types';
import { daysBetween, dotDate, gaugeDiff, gaugeText, parseYmd } from './util';

// 아이패드 세로 비율(834 × 1194). PDF 한 쪽도 이 크기(포인트)로 만들어요.
const W = 834;
const H = 1194;
const SCALE = 2; // 선명하게 2배로 그려요
const FONT = '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const INK = '#2B2B28';
const QUIET = '#66655F';
const LINE = '#DCD8CC';
const L = 52; // 왼쪽 여백
const R = W - 52; // 오른쪽 끝



interface Ctx {
  c: CanvasRenderingContext2D;
  t: Theme;
}

function newPage() {
  const cv = document.createElement('canvas');
  cv.width = W * SCALE;
  cv.height = H * SCALE;
  const c = cv.getContext('2d')!;
  c.scale(SCALE, SCALE);
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic';
  return { cv, c };
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 15, color = INK, weight = 400, align: CanvasTextAlign = 'left') {
  c.font = `${weight} ${size}px ${FONT}`;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(s, x, y);
}

/** 넓이에 맞게 줄을 나눠 쓰고, 마지막 y를 돌려줘요 */
function wrap(c: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, lineH: number, maxLines: number, size = 15, color = INK) {
  c.font = `400 ${size}px ${FONT}`;
  c.fillStyle = color;
  c.textAlign = 'left';
  let lines = 0;
  for (const para of s.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (c.measureText(line + ch).width > maxW && line) {
        if (lines >= maxLines) return y;
        c.fillText(line, x, y);
        y += lineH;
        lines++;
        line = ch;
      } else line += ch;
    }
    if (lines >= maxLines) return y;
    c.fillText(line, x, y);
    y += lineH;
    lines++;
  }
  return y;
}

function fit(c: CanvasRenderingContext2D, s: string, maxW: number) {
  if (c.measureText(s).width <= maxW) return s;
  let t = s;
  while (t && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function hline(c: CanvasRenderingContext2D, x1: number, x2: number, y: number, color = LINE) {
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x1, y + 0.5);
  c.lineTo(x2, y + 0.5);
  c.stroke();
}

function header(k: Ctx, title: string, right: string) {
  rr(k.c, L, 48, R - L, 56, 14);
  k.c.fillStyle = k.t.color;
  k.c.fill();
  k.c.font = `700 22px ${FONT}`;
  text(k.c, fit(k.c, title, 520), L + 24, 84, 22, '#FFFFFF', 700);
  text(k.c, right, R - 24, 82, 13, '#FFFFFF', 400, 'right');
}

function label(k: Ctx, s: string, x: number, y: number) {
  text(k.c, s, x, y, 13, k.t.color, 500);
}

function footer(k: Ctx, p: Project) {
  text(k.c, `뜨개 다이어리 · ${p.startDate.slice(0, 4)} · ${p.name}`, W / 2, H - 32, 12, QUIET, 400, 'center');
}

function ruled(k: Ctx, y0: number, y1: number, gap = 40) {
  for (let y = y0 + gap; y < y1; y += gap) hline(k.c, L, R, y);
}

async function drawPhoto(k: Ctx, blob: Blob | undefined, x: number, y: number, w: number, h: number, empty: string) {
  const c = k.c;
  c.save();
  rr(c, x, y, w, h, 12);
  c.clip();
  if (blob) {
    const img = await loadImage(blob);
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * s;
    const ih = img.naturalHeight * s;
    c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    c.fillStyle = '#EFE9DC';
    c.fillRect(x, y, w, h);
    text(c, empty, x + w / 2, y + h / 2 + 5, 13, QUIET, 400, 'center');
  }
  c.restore();
}

async function page1(p: Project, photos: Photo[], t: Theme) {
  const { cv, c } = newPage();
  const k = { c, t };
  header(k, p.name || '이름 없는 작품', '프로젝트 기록');
  await drawPhoto(k, photos[0]?.blob, L, 128, 240, 300, '완성 사진');

  // 기본 정보
  const fx = L + 264;
  const vx = fx + 84;
  const period = p.endDate ? `${dotDate(p.startDate)} – ${dotDate(p.endDate)} (${daysBetween(p.startDate, p.endDate)}일)` : `${dotDate(p.startDate)} – 진행 중`;
  const rows: [string, string][] = [
    ['도안', [p.source, p.pattern].filter(Boolean).join(' · ')],
    ['기간', period],
    ['사이즈', p.size],
    ['사용 대상', p.audience]
  ];
  let y = 158;
  for (const [lb, v] of rows) {
    label(k, lb, fx, y);
    c.font = `400 15px ${FONT}`;
    text(c, fit(c, v, R - vx), vx, y, 15);
    hline(c, vx, R, y + 10);
    y += 52;
  }
  label(k, '난이도', fx, y);
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.arc(vx + 9 + i * 26, y - 5, 9, 0, Math.PI * 2);
    c.strokeStyle = t.color;
    c.lineWidth = 1.5;
    c.stroke();
    if (i < p.difficulty) {
      c.fillStyle = t.color;
      c.fill();
    }
  }
  hline(c, vx, R, y + 10);

  // 실 기록 표
  y = 470;
  label(k, '실 기록', L, y);
  y += 14;
  const cols = [
    ['실 이름 · 브랜드', 220],
    ['색상 · 로트', 180],
    ['굵기', 90],
    ['사용량', 120],
    ['남은 양', 120]
  ] as const;
  const tw = R - L;
  c.fillStyle = t.tint;
  c.fillRect(L, y, tw, 36);
  let x = L;
  for (const [h, w] of cols) {
    text(c, h, x + 10, y + 23, 13, INK, 500);
    x += w;
  }
  const yarnRows = [...p.yarns];
  while (yarnRows.length < 2) yarnRows.push({ brand: '', name: '', color: '', lot: '', weight: '', used: '', remaining: '' });
  const ty0 = y;
  y += 36;
  for (const yr of yarnRows.slice(0, 4)) {
    const vals = [[yr.brand, yr.name].filter(Boolean).join(' '), [yr.color, yr.lot].filter(Boolean).join(' · '), yr.weight, yr.used, yr.remaining];
    x = L;
    vals.forEach((v, i) => {
      c.font = `400 14px ${FONT}`;
      text(c, fit(c, v, cols[i][1] - 20), x + 10, y + 26, 14);
      x += cols[i][1];
    });
    y += 40;
  }
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.strokeRect(L + 0.5, ty0 + 0.5, tw, y - ty0);
  x = L;
  for (const [, w] of cols.slice(0, -1)) {
    x += w;
    c.beginPath();
    c.moveTo(x + 0.5, ty0);
    c.lineTo(x + 0.5, y);
    c.stroke();
  }
  for (let ry = ty0 + 36; ry < y; ry += 40) hline(c, L, R, ry);

  // 바늘 · 게이지
  y += 40;
  const half = L + tw / 2 + 12;
  label(k, '바늘', L, y);
  label(k, '게이지 (10cm)', half, y);
  let ny = y + 32;
  const needles = p.needles.length ? p.needles : [{ size: '', kind: '', use: '' }];
  for (const n of needles.slice(0, 3)) {
    c.font = `400 15px ${FONT}`;
    text(c, fit(c, [n.size, n.kind, n.use].filter(Boolean).join(' · '), tw / 2 - 24), L, ny, 15);
    hline(c, L, L + tw / 2 - 12, ny + 10);
    ny += 40;
  }
  let gy = y + 32;
  const gauges = p.gauges.length ? p.gauges : [{ pattern: '', patSt: null, patRow: null, mySt: null, myRow: null }];
  for (const g of gauges.slice(0, 3)) {
    const d = gaugeDiff(g, p.chestCm);
    const s = [g.pattern, gaugeText(g.patSt, g.patRow) && `도안 ${gaugeText(g.patSt, g.patRow)}`, gaugeText(g.mySt, g.myRow) && `내 ${gaugeText(g.mySt, g.myRow)}`, d && d.pct !== 0 ? `코 ${d.pct > 0 ? '+' : ''}${d.pct}%` : '']
      .filter(Boolean)
      .join(' · ');
    c.font = `400 15px ${FONT}`;
    text(c, fit(c, s, R - half), half, gy, 15);
    hline(c, half, R, gy + 10);
    gy += 40;
  }

  // 메모
  y = Math.max(ny, gy) + 30;
  label(k, '수정한 부분과 이유 · 한 줄 소감', L, y);
  let my = y + 34;
  if (p.memo) my = wrap(c, p.memo, L, my, tw, 40, 4) - 6;
  ruled(k, my - 34, H - 64);
  footer(k, p);
  return cv;
}

function miniMonth(k: Ctx, year: number, month: number, x: number, y: number, inPeriod: (d: string) => boolean, knit: Set<string>) {
  const c = k.c;
  const cw = 42;
  text(c, `${year}년 ${month + 1}월`, x, y, 14, INK, 700);
  const heads = ['일', '월', '화', '수', '목', '금', '토'];
  heads.forEach((h, i) => text(c, h, x + i * cw + cw / 2, y + 28, 12, QUIET, 400, 'center'));
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const idx = first + d - 1;
    const cx = x + (idx % 7) * cw;
    const cy = y + 40 + Math.floor(idx / 7) * 34;
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (knit.has(key)) {
      rr(c, cx + 3, cy, cw - 6, 28, 6);
      c.fillStyle = k.t.color;
      c.fill();
      text(c, String(d), cx + cw / 2, cy + 19, 12, '#FFFFFF', 700, 'center');
    } else if (inPeriod(key)) {
      rr(c, cx + 3, cy, cw - 6, 28, 6);
      c.fillStyle = k.t.tint;
      c.fill();
      text(c, String(d), cx + cw / 2, cy + 19, 12, INK, 400, 'center');
    } else text(c, String(d), cx + cw / 2, cy + 19, 12, INK, 400, 'center');
  }
  return y + 40 + Math.ceil((first + days) / 7) * 34;
}

async function page2(p: Project, photos: Photo[], t: Theme) {
  const { cv, c } = newPage();
  const k = { c, t };
  header(k, `${p.name || '작품'} · 진행 기록`, '');
  const end = p.endDate ?? new Date().toISOString().slice(0, 10);
  const inPeriod = (d: string) => d >= p.startDate && d <= end;
  const knit = new Set(p.log.filter((l) => l.rows > 0).map((l) => l.date));

  // 왼쪽: 뜬 날 달력 (최대 2달)
  label(k, '뜬 날', L, 140);
  const s = parseYmd(p.startDate);
  const e = parseYmd(end);
  let my = 168;
  const months: [number, number][] = [[s.getFullYear(), s.getMonth()]];
  if (e.getFullYear() !== s.getFullYear() || e.getMonth() !== s.getMonth()) months.push([e.getFullYear(), e.getMonth()]);
  for (const [yy, mm] of months) my = miniMonth(k, yy, mm, L, my, inPeriod, knit) + 18;

  // 오른쪽: 파트별 표
  const tx = L + 330;
  label(k, '파트별', tx, 140);
  let ty = 154;
  const cw = [150, 110, 140];
  c.fillStyle = t.tint;
  c.fillRect(tx, ty, R - tx, 34);
  ['파트', '단수', '완료일'].forEach((h, i) => text(c, h, tx + 10 + cw.slice(0, i).reduce((a, b) => a + b, 0), ty + 22, 13, INK, 500));
  ty += 34;
  for (const part of p.parts.slice(0, 8)) {
    const vals = [part.name, part.target ? `${part.count} / ${part.target}단` : `${part.count}단`, part.doneDate ? dotDate(part.doneDate).slice(5) : ''];
    vals.forEach((v, i) => {
      c.font = `400 14px ${FONT}`;
      text(c, fit(c, v, cw[i] - 16), tx + 10 + cw.slice(0, i).reduce((a, b) => a + b, 0), ty + 25, 14);
    });
    ty += 38;
    hline(c, tx, R, ty);
  }
  c.strokeStyle = LINE;
  c.strokeRect(tx + 0.5, 154.5, R - tx, ty - 154);

  // 진행 사진 (최대 3장)
  let y = Math.max(my, ty) + 20;
  label(k, '진행 사진', L, y);
  y += 14;
  const pw = (R - L - 24) / 3;
  for (let i = 0; i < 3; i++) {
    const ph = photos[i];
    await drawPhoto(k, ph?.blob, L + i * (pw + 12), y, pw, 200, '사진');
    if (ph) {
      c.font = `400 13px ${FONT}`;
      text(c, fit(c, [ph.tag, ph.caption].filter(Boolean).join(' · '), pw), L + i * (pw + 12), y + 222, 13, QUIET);
    }
  }

  // 일지
  y += 262;
  label(k, '일지', L, y);
  const byDate = new Map<string, string[]>();
  for (const l of [...p.log].sort((a, b) => a.date.localeCompare(b.date))) {
    if (l.rows <= 0) continue;
    const name = p.parts.find((x) => x.id === l.partId)?.name ?? '';
    byDate.set(l.date, [...(byDate.get(l.date) ?? []), `${name} +${l.rows}단`]);
  }
  let ly = y + 34;
  const entries = [...byDate.entries()].slice(-6);
  for (const [d, items] of entries) {
    text(c, dotDate(d).slice(5), L, ly, 14, QUIET);
    c.font = `400 14px ${FONT}`;
    text(c, fit(c, items.join(' · '), R - L - 70), L + 70, ly, 14);
    hline(c, L, R, ly + 12);
    ly += 40;
  }
  ruled(k, ly - 28, H - 64);
  footer(k, p);
  return cv;
}

function page3(p: Project, t: Theme) {
  const { cv, c } = newPage();
  const k = { c, t };
  text(c, `${p.name || '작품'} · 자유 페이지`, L, 80, 18, INK, 700);
  c.fillStyle = t.color;
  c.fillRect(L, 96, R - L, 2);
  c.fillStyle = '#C9CFC4';
  for (let y = 124; y < H - 70; y += 20) for (let x = L; x <= R; x += 20) c.fillRect(x - 1, y - 1, 2.2, 2.2);
  text(c, '스와치 사진 붙이기 · 스케치 · 다음에 바꿀 점', W / 2, H - 32, 12, QUIET, 400, 'center');
  void k;
  return cv;
}

/** pages: [1쪽, 2쪽, 3쪽] 포함 여부 */
export async function buildPdf(p: Project, photos: Photo[], pages: boolean[], themeId: string): Promise<Blob> {
  const t = THEMES.find((x) => x.id === themeId) ?? THEMES[0];
  const chosen = photos.filter((x) => x.inPdf).slice(0, 3);
  const cover = chosen[0] ? [chosen[0]] : photos.slice(0, 1);
  const canvases: HTMLCanvasElement[] = [];
  if (pages[0]) canvases.push(await page1(p, cover, t));
  if (pages[1]) canvases.push(await page2(p, chosen, t));
  if (pages[2]) canvases.push(page3(p, t));
  const doc = await PDFDocument.create();
  doc.setTitle(p.name || '뜨개 기록');
  doc.setCreator('뜨개 다이어리');
  for (const cv of canvases) {
    const jpg = await new Promise<Blob>((res) => cv.toBlob((b) => res(b!), 'image/jpeg', 0.9));
    const img = await doc.embedJpg(await jpg.arrayBuffer());
    const page = doc.addPage([W, H]);
    page.drawImage(img, { x: 0, y: 0, width: W, height: H });
  }
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
