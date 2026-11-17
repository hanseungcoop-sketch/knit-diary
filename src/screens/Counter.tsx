import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { getProject, savePhoto, saveProject } from '../lib/db';
import { prefs, useLandscape, usePatterns } from '../lib/hooks';
import { shrinkImage } from '../lib/image';
import type { Part, Project } from '../lib/types';
import { decInfo, uid, ymd } from '../lib/util';
import { Icon } from '../components/ui';

// 도안 보기(PDF 라이브러리)는 쓸 때만 불러와요
const PatternViewer = lazy(() => import('../components/PatternViewer'));

type WakeLock = { release: () => Promise<void> };

/** 뜨는 동안 화면이 꺼지지 않게 해요 (지원하는 브라우저에서만) */
function useWakeLock() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let lock: WakeLock | null = null;
    const req = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }).wakeLock;
        if (wl && document.visibilityState === 'visible') {
          lock = await wl.request('screen');
          setOn(true);
        }
      } catch {
        setOn(false);
      }
    };
    req();
    document.addEventListener('visibilitychange', req);
    return () => {
      document.removeEventListener('visibilitychange', req);
      lock?.release().catch(() => {});
    };
  }, []);
  return on;
}

export default function Counter({ id }: { id: string }) {
  const [p, setP] = useState<Project | null>(null);
  const [partId, setPartId] = useState<string>('');
  const [toast, setToast] = useState('');
  const [mode, setModeState] = useState<'counter' | 'pattern'>(() => (prefs.get('mode:' + id) === 'pattern' ? 'pattern' : 'counter'));
  const [nudge, setNudge] = useState({ seq: 0, delta: 0 });
  const ref = useRef<Project | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const awake = useWakeLock();
  const landscape = useLandscape();
  const patterns = usePatterns(id);

  useEffect(() => {
    getProject(id).then((x) => {
      if (!x) return;
      ref.current = x;
      setP(x);
      const saved = prefs.get('part:' + id);
      setPartId((x.parts.find((pt) => pt.id === saved) ?? x.parts.find((pt) => !pt.doneDate) ?? x.parts[0]).id);
    });
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!p) return null;
  const part = p.parts.find((x) => x.id === partId) ?? p.parts[0];
  const info = decInfo(part);

  const setMode = (m: 'counter' | 'pattern') => {
    prefs.set('mode:' + id, m);
    setModeState(m);
  };
  const pickPart = (pid: string) => {
    prefs.set('part:' + id, pid);
    setPartId(pid);
  };

  // 항상 가장 최근 상태에서 바꿔서 빠르게 연타해도 숫자가 빠지지 않게 해요
  const update = (fn: (pr: Project) => Project) => {
    const next = fn(structuredClone(ref.current!));
    ref.current = next;
    setP(next);
    saveProject(next);
  };

  const step = (delta: 1 | -1) => {
    if (delta < 0 && part.count === 0) return;
    update((pr) => {
      const pt = pr.parts.find((x) => x.id === part.id)!;
      pt.count += delta;
      if (pt.repeatLen) pt.repeat = delta > 0 ? (pt.repeat % pt.repeatLen) + 1 : pt.repeat === 1 ? pt.repeatLen : pt.repeat - 1;
      const today = ymd();
      const entry = pr.log.find((l) => l.date === today && l.partId === pt.id);
      if (entry) entry.rows = Math.max(0, entry.rows + delta);
      else if (delta > 0) pr.log.push({ date: today, partId: pt.id, rows: 1 });
      if (pt.target && pt.count >= pt.target && !pt.doneDate) {
        pt.doneDate = today;
        setToast(`${pt.name} 목표 ${pt.target}단 완료!`);
      }
      if (pt.doneDate && pt.target && pt.count < pt.target) pt.doneDate = null;
      return pr;
    });
    setNudge((n) => ({ seq: n.seq + 1, delta }));
  };

  const bumpRepeat = () =>
    update((pr) => {
      const pt = pr.parts.find((x) => x.id === part.id)!;
      if (pt.repeatLen) pt.repeat = (pt.repeat % pt.repeatLen) + 1;
      return pr;
    });

  const addPhoto = async (f?: File) => {
    if (!f) return;
    const blob = await shrinkImage(f);
    await savePhoto({ id: uid(), projectId: p.id, blob, createdAt: Date.now(), date: ymd(), tag: `${part.name} ${part.count}단`, caption: '', inPdf: false });
    setToast(`사진 저장됨 · ${part.name} ${part.count}단`);
  };

  const pct = part.target ? Math.min(100, Math.round((part.count / part.target) * 100)) : 0;
  const nPat = patterns?.length ?? 0;

  const photoBtn = (
    <>
      <button type="button" className="btn pill" onClick={() => fileRef.current?.click()} aria-label="지금 단수로 사진 찍기">
        <Icon name="camera" />
        사진
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addPhoto(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
    </>
  );
  const modeBtn = (
    <button type="button" className={`btn pill ${mode === 'pattern' ? 'primary' : ''}`} aria-pressed={mode === 'pattern'} onClick={() => setMode(mode === 'pattern' ? 'counter' : 'pattern')}>
      <Icon name="pdf" />
      {mode === 'pattern' ? '도안 닫기' : nPat ? '도안 함께 보기' : '도안 추가'}
    </button>
  );
  const header = (compact: boolean) => (
    <header className="top">
      <a className="icon-btn" href={`#/project/${p.id}`} aria-label="작품 상세로">
        <Icon name="back" />
      </a>
      <div className="titles">
        <h1 style={{ fontSize: compact ? 18 : 22 }}>{p.name}</h1>
        {!compact && (
          <p className="sub" style={{ fontSize: 13 }}>
            {awake ? '화면 꺼짐 방지 켜짐' : '화면 꺼짐 방지를 지원하지 않는 환경이에요'}
          </p>
        )}
      </div>
      {modeBtn}
      {photoBtn}
    </header>
  );

  const chips = p.parts.length > 1 && (
    <div className="row wrap" role="group" aria-label="파트 선택">
      {p.parts.map((pt: Part) => (
        <button key={pt.id} type="button" className={`chip ${pt.id === part.id ? 'on' : ''}`} aria-pressed={pt.id === part.id} onClick={() => pickPart(pt.id)}>
          {`${pt.name} · ${pt.count}${pt.target ? `/${pt.target}` : ''}단`}
        </button>
      ))}
    </div>
  );
  const tap = (
    <button type="button" className={`tap ${info.isNow ? 'flash' : ''}`} onClick={() => step(1)} aria-label={`한 단 추가, 지금 ${part.count}단`}>
      <span className="meta">
        {part.name}
        {part.target ? ` · 목표 ${part.target}단` : ''}
      </span>
      <span className="num" aria-live="polite">
        {part.count}
      </span>
      <span className="meta">아무 데나 탭하면 +1</span>
      {part.target > 0 && (
        <span className="tbar">
          <span style={{ width: `${pct}%` }} />
        </span>
      )}
    </button>
  );
  const notices = (
    <>
      {info.isNow && (
        <div className="notice warn" role="status" style={{ fontSize: 17, fontWeight: 700 }}>
          지금 뜨는 {part.count + 1}단: {part.decText || '알림 단이에요'}
        </div>
      )}
      {toast && (
        <div className="notice ok" role="status" style={{ fontWeight: 700 }}>
          {toast}
        </div>
      )}
    </>
  );
  const nextText = info.next ? `${info.next - part.count - 1}단 뒤` : info.isNow ? '지금' : '없음';
  const tools = (
    <div className="counter-tools">
      <button type="button" className="tool" onClick={() => step(-1)}>
        <span className="v">−1</span>
        <span className="k">잘못 눌렀을 때</span>
      </button>
      {part.repeatLen > 0 ? (
        <button type="button" className="tool" onClick={bumpRepeat}>
          <span className="k">무늬 반복</span>
          <span className="v">
            {part.repeat} / {part.repeatLen}단
          </span>
          <span className="k">한 단마다 같이 올라가요</span>
        </button>
      ) : (
        <a className="tool" href={`#/edit/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="k">무늬 반복</span>
          <span className="v" style={{ fontSize: 18 }}>
            설정하기
          </span>
        </a>
      )}
      <div className="tool info">
        <span className="k">다음 알림</span>
        <span className="v" style={{ fontSize: 24 }}>
          {nextText}
        </span>
        <span className="k">{info.any ? (info.next ? `${info.next}단: ${part.decText || '알림'}` : '마지막 알림') : '편집에서 알림 규칙 추가'}</span>
      </div>
    </div>
  );
  const viewer = (
    <Suspense fallback={<div className="pv" />}>
      <PatternViewer projectId={p.id} nudge={nudge} />
    </Suspense>
  );

  // 1) 도안 + 카운터, 가로: 나란히
  if (mode === 'pattern' && landscape)
    return (
      <main className="split">
        {viewer}
        <aside className="cpanel" aria-label="단수 카운터">
          {header(true)}
          {chips}
          {tap}
          {notices}
          {tools}
        </aside>
      </main>
    );

  // 2) 도안 + 카운터, 세로: 도안 아래에 작은 카운터
  if (mode === 'pattern')
    return (
      <main className="stacked">
        {header(true)}
        {viewer}
        {(info.isNow || toast) && <div style={{ padding: '8px 14px 0' }}>{notices}</div>}
        <section className="dock" aria-label="단수 카운터">
          <div className="info">
            <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
              {p.parts.length > 1 ? (
                <label>
                  <span className="sr-only">파트</span>
                  <select value={part.id} onChange={(e) => pickPart(e.target.value)}>
                    {p.parts.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <b>{part.name}</b>
              )}
              <span className="big" aria-live="polite">
                {part.count}
              </span>
              {part.target > 0 && <span className="sub">/ {part.target}단</span>}
            </div>
            <span className="sub" style={{ fontSize: 13 }}>
              {[part.repeatLen ? `무늬 ${part.repeat}/${part.repeatLen}` : '', info.any ? `다음 알림 ${nextText}` : ''].filter(Boolean).join(' · ') || '탭하면 도안의 자도 같이 움직여요'}
            </span>
          </div>
          <button type="button" className="minus" onClick={() => step(-1)} aria-label="한 단 빼기">
            −1
          </button>
          <button type="button" className={`plus ${info.isNow ? 'flash' : ''}`} onClick={() => step(1)} aria-label={`한 단 추가, 지금 ${part.count}단`}>
            +1 단
          </button>
        </section>
      </main>
    );

  // 3) 카운터만
  return (
    <main className="counter-page">
      {header(false)}
      {chips}
      {tap}
      {notices}
      {tools}
    </main>
  );
}
