import { useEffect, useRef, useState } from 'react';
import { openPdf, type PDFDocumentProxy, type RenderTask } from '../lib/pdfjs';
import { savePattern } from '../lib/db';
import { prefs, usePatterns } from '../lib/hooks';
import type { PatternFile, Ruler } from '../lib/types';
import { addPatternFile } from '../lib/patterns';
import { Icon } from './ui';

// 같은 PDF를 여러 번 열지 않도록 기억해둬요
const docs = new Map<string, Promise<PDFDocumentProxy>>();
const openDoc = (p: PatternFile) => {
  if (!docs.has(p.id)) docs.set(p.id, p.blob.arrayBuffer().then((buf) => openPdf(new Uint8Array(buf)).promise));
  return docs.get(p.id)!;
};

const ZOOMS = [1, 1.5, 2, 3];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** nudge: 카운터를 탭할 때마다 seq가 1씩 늘고, delta(+1/−1)만큼 자를 옮겨요 */
export default function PatternViewer({ projectId, nudge }: { projectId: string; nudge?: { seq: number; delta: number } }) {
  const patterns = usePatterns(projectId);
  const [pat, setPat] = useState<PatternFile | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(0);
  const [pageH, setPageH] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const patRef = useRef<PatternFile | null>(null);
  patRef.current = pat;

  // 어떤 도안을 보여줄지 정해요 (마지막으로 본 도안 우선)
  useEffect(() => {
    if (!patterns) return;
    if (pat && patterns.some((x) => x.id === pat.id)) return;
    const want = prefs.get('pattern:' + projectId);
    const pick = patterns.find((x) => x.id === want) ?? patterns[0] ?? null;
    setPat(pick ? { ...pick } : null);
  }, [patterns, pat, projectId]);

  useEffect(() => {
    if (!pat) return;
    let alive = true;
    setDoc(null);
    setError('');
    openDoc(pat)
      .then((d) => alive && setDoc(d))
      .catch(() => alive && setError('이 PDF를 열 수 없어요. 암호가 걸려 있거나 손상된 파일일 수 있어요.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pat?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pat?.id]);

  // 쪽 그리기
  useEffect(() => {
    if (!doc || !pat || !width || !canvasRef.current) return;
    let task: RenderTask | null = null;
    let alive = true;
    (async () => {
      const page = await doc.getPage(clamp(pat.page, 1, doc.numPages));
      const base = page.getViewport({ scale: 1 });
      const cssW = Math.max(200, (width - 32) * pat.zoom);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: (cssW / base.width) * dpr });
      const cv = canvasRef.current;
      if (!alive || !cv) return;
      cv.width = Math.floor(viewport.width);
      cv.height = Math.floor(viewport.height);
      cv.style.width = `${cssW}px`;
      cv.style.height = `${(cssW * base.height) / base.width}px`;
      setPageH((cssW * base.height) / base.width);
      task = page.render({ canvas: cv, viewport });
      await task.promise.catch(() => {});
    })();
    return () => {
      alive = false;
      task?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pat?.id, pat?.page, pat?.zoom, width]);

  const update = (patch: Partial<PatternFile>, quiet = true) => {
    const cur = patRef.current;
    if (!cur) return;
    const next = { ...cur, ...patch };
    setPat(next);
    savePattern(next, quiet);
  };

  const ruler = pat?.ruler && pat.ruler.page === pat.page ? pat.ruler : null;
  const setRuler = (r: Ruler | null, save = true) => {
    const cur = patRef.current;
    if (!cur) return;
    const next = { ...cur, ruler: r };
    setPat(next);
    if (save) savePattern(next, true);
  };
  const moveRows = (rows: number) => {
    const r = patRef.current?.ruler;
    if (!r || r.page !== patRef.current?.page) return;
    setRuler({ ...r, top: clamp(r.top - rows * r.h, 0, 1 - r.h) });
  };

  // 카운터 탭 → 자 한 줄 이동 (차트는 아래에서 위로 읽어요)
  const lastSeq = useRef(nudge?.seq ?? 0);
  useEffect(() => {
    if (!nudge || nudge.seq === lastSeq.current) return;
    lastSeq.current = nudge.seq;
    if (patRef.current?.follow) moveRows(nudge.delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge?.seq]);

  // 자가 화면 밖으로 나가면 보이는 곳으로 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ruler || !pageH) return;
    const y = 16 + ruler.top * pageH;
    if (y < el.scrollTop + 40 || y > el.scrollTop + el.clientHeight - 80) el.scrollTo({ top: Math.max(0, y - el.clientHeight / 2), behavior: 'smooth' });
  }, [ruler?.top, pageH, ruler]);

  // 자 끌기 / 높이 조절
  const drag = (mode: 'move' | 'size') => (e: React.PointerEvent) => {
    if (!ruler || !pageH) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const start = { ...ruler };
    let last = start;
    const onMove = (ev: PointerEvent) => {
      const d = (ev.clientY - y0) / pageH;
      last = mode === 'move' ? { ...start, top: clamp(start.top + d, 0, 1 - start.h) } : { ...start, h: clamp(start.h + d, 0.006, 0.3) };
      setRuler(last, false);
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setRuler(last, true);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  const onAdd = async (f?: File) => {
    if (!f) return;
    const p = await addPatternFile(projectId, f);
    setPat({ ...p });
  };
  const choose = (p: PatternFile) => {
    prefs.set('pattern:' + projectId, p.id);
    setPat({ ...p });
  };

  const fileInput = <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => onAdd(e.target.files?.[0]).finally(() => (e.target.value = ''))} />;

  if (!patterns) return <div className="pv" />;
  if (!pat)
    return (
      <div className="pv">
        <div className="empty" style={{ margin: 'auto' }}>
          <Icon name="pdf" size={40} />
          <p>이 작품에 붙인 도안 PDF가 없어요.</p>
          <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>
            도안 PDF 불러오기
          </button>
          <p className="sub" style={{ fontSize: 13 }}>
            파일 앱, iCloud Drive, 다운로드 폴더에서 고를 수 있어요.
          </p>
          {fileInput}
        </div>
      </div>
    );

  const n = doc?.numPages ?? 0;
  const zi = Math.max(0, ZOOMS.indexOf(pat.zoom));

  return (
    <div className="pv">
      <div className="pv-bar">
        <div className="row wrap" style={{ gap: 8, flex: 1, minWidth: 0 }} role="tablist" aria-label="도안 파일">
          {patterns.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === pat.id} className={`chip small ${p.id === pat.id ? 'on' : ''}`} onClick={() => choose(p)}>
              {p.name}
            </button>
          ))}
          <button type="button" className="chip small dashed" onClick={() => fileRef.current?.click()}>
            + 도안 추가
          </button>
          {fileInput}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="icon-btn sm" aria-label="이전 쪽" disabled={pat.page <= 1} onClick={() => update({ page: pat.page - 1 })}>
            <Icon name="back" size={18} />
          </button>
          <span style={{ minWidth: 56, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
            {pat.page} / {n || '…'}
          </span>
          <button type="button" className="icon-btn sm" aria-label="다음 쪽" disabled={!n || pat.page >= n} onClick={() => update({ page: pat.page + 1 })}>
            <Icon name="next" size={18} />
          </button>
        </div>
      </div>
      <div className="pv-bar sub-bar">
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="icon-btn sm" aria-label="축소" disabled={zi === 0} onClick={() => update({ zoom: ZOOMS[zi - 1] })}>
            −
          </button>
          <span style={{ minWidth: 48, textAlign: 'center', fontSize: 14 }}>{Math.round(pat.zoom * 100)}%</span>
          <button type="button" className="icon-btn sm" aria-label="확대" disabled={zi === ZOOMS.length - 1} onClick={() => update({ zoom: ZOOMS[zi + 1] })}>
            +
          </button>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <button type="button" className={`chip small ${ruler ? 'on' : ''}`} aria-pressed={!!ruler} onClick={() => setRuler(ruler ? null : { page: pat.page, top: 0.45, h: 0.03 })}>
            줄 표시 자
          </button>
          {ruler && (
            <>
              <button type="button" className="icon-btn sm" aria-label="자 한 줄 위로" onClick={() => moveRows(1)}>
                ▲
              </button>
              <button type="button" className="icon-btn sm" aria-label="자 한 줄 아래로" onClick={() => moveRows(-1)}>
                ▼
              </button>
              <label className="row" style={{ gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={pat.follow} onChange={(e) => update({ follow: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
                탭하면 같이 이동
              </label>
            </>
          )}
        </div>
      </div>
      <div className="pv-scroll" ref={scrollRef}>
        {error ? (
          <p className="notice warn">{error}</p>
        ) : (
          <div className="pv-page" style={{ width: Math.max(200, (width - 32) * pat.zoom) }}>
            <canvas ref={canvasRef} aria-label={`${pat.name} ${pat.page}쪽`} role="img" />
            {ruler && pageH > 0 && (
              <div className="ruler" style={{ top: ruler.top * pageH, height: Math.max(8, ruler.h * pageH) }} onPointerDown={drag('move')}>
                <span className="ruler-grip" onPointerDown={drag('size')} aria-label="줄 높이 조절" role="slider" aria-valuenow={Math.round(ruler.h * 1000)} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
