import { useEffect, useState } from 'react';
import { listPhotos } from '../lib/db';
import { useProjects } from '../lib/hooks';
import { THEMES } from '../lib/themes';
import { shareFile } from '../lib/share';
import { dotDate } from '../lib/util';
import { Icon, TabBar } from '../components/ui';

const PAGES = ['1 작품 정보', '2 진행 기록', '3 자유 (모눈)'];

export default function Export({ id }: { id?: string }) {
  const projects = useProjects();
  const [pid, setPid] = useState(id ?? '');
  const [mode, setMode] = useState<'one' | 'all' | 'custom'>('all');
  const [custom, setCustom] = useState([true, true, true]);
  const [theme, setTheme] = useState(THEMES[0].id);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pid && projects?.length) setPid(projects[0].id);
  }, [projects, pid]);
  if (!projects) return null;

  const inc = mode === 'one' ? [true, false, false] : mode === 'all' ? [true, true, true] : custom;
  const n = inc.filter(Boolean).length;
  const project = projects.find((p) => p.id === pid);

  const toggle = (i: number) => {
    const next = [...inc];
    next[i] = !next[i];
    if (next.every((x) => !x)) return;
    setCustom(next);
    setMode('custom');
  };

  const run = async () => {
    if (!project) return;
    setBusy(true);
    setStatus('PDF를 만들고 있어요…');
    try {
      const photos = await listPhotos(project.id);
      const { buildPdf } = await import('../lib/pdf'); // PDF 기능은 필요할 때만 불러와요
      const pdf = await buildPdf(project, photos, inc, theme);
      const r = await shareFile(pdf, `${project.name || '뜨개 기록'}.pdf`, project.name);
      setStatus(r === 'shared' ? '보냈어요.' : r === 'cancelled' ? '' : '파일로 내려받았어요. 파일 앱에서 GoodNotes나 Flexcil로 열 수 있어요.');
    } catch (e) {
      setStatus(`만들지 못했어요: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <main className="page">
        <header className="stack tight">
          <h1 className="big-title">PDF 내보내기</h1>
          <p className="sub" style={{ fontSize: 15 }}>
            판형: 아이패드 비율 · GoodNotes와 Flexcil에서 여백 없이 꽉 차요
          </p>
        </header>

        {projects.length === 0 ? (
          <div className="card empty">
            <p>먼저 작품을 기록해주세요.</p>
            <a className="btn primary" href="#/new">
              새 작품
            </a>
          </div>
        ) : (
          <>
            <label className="field" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
              작품
              <select value={pid} onChange={(e) => setPid(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.status === 'done' ? `${dotDate(p.startDate)} – ${dotDate(p.endDate)}` : '진행 중'}
                  </option>
                ))}
              </select>
            </label>

            <section className="stack">
              <div className="row between">
                <h2 className="h3">들어갈 쪽</h2>
                <span className="sub">총 {n}쪽</span>
              </div>
              <div className="seg" role="radiogroup" aria-label="쪽 선택">
                <button type="button" role="radio" aria-checked={mode === 'one'} onClick={() => setMode('one')}>
                  1쪽만 (작품 정보)
                </button>
                <button type="button" role="radio" aria-checked={mode === 'all'} onClick={() => setMode('all')}>
                  3쪽 모두
                </button>
                <button type="button" role="radio" aria-checked={mode === 'custom'} onClick={() => { setCustom(inc); setMode('custom'); }}>
                  직접 고르기
                </button>
              </div>
              <div className="grid3">
                {PAGES.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={inc[i]}
                    onClick={() => toggle(i)}
                    className="stack tight"
                    style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', opacity: inc[i] ? 1 : 0.35 }}
                  >
                    <span
                      style={{
                        height: 180,
                        borderRadius: 10,
                        border: '1px solid var(--line)',
                        background: i === 2 ? '#fff radial-gradient(#c9cfc4 1px, transparent 1px) 0 0 / 12px 12px' : '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: 14
                      }}
                    >
                      {i < 2 && <span style={{ height: 18, borderRadius: 4, background: THEMES.find((t) => t.id === theme)!.color }} />}
                      {i === 0 && <span style={{ height: 60, borderRadius: 4, background: '#efe9dc' }} />}
                      {i < 2 && <span style={{ height: 6, width: '80%', background: '#dcd8cc' }} />}
                      {i < 2 && <span style={{ height: 6, width: '60%', background: '#dcd8cc' }} />}
                    </span>
                    <span className="row between" style={{ fontSize: 15 }}>
                      <span>{label}</span>
                      <b style={{ color: 'var(--accent-dark)' }}>{inc[i] ? '포함' : ''}</b>
                    </span>
                  </button>
                ))}
              </div>
              {mode === 'custom' && <p className="sub">넣고 싶은 쪽을 눌러서 켜고 끄세요.</p>}
            </section>

            <fieldset className="row" style={{ border: 'none', padding: 0, margin: 0, gap: 14 }}>
              <legend className="h3" style={{ paddingBottom: 12 }}>
                색 테마
              </legend>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`${t.name}${theme === t.id ? ' (선택됨)' : ''}`}
                  aria-pressed={theme === t.id}
                  onClick={() => setTheme(t.id)}
                  style={{ width: 44, height: 44, borderRadius: 22, background: t.color, border: '3px solid #fff', outline: theme === t.id ? '2px solid var(--ink)' : 'none', cursor: 'pointer' }}
                />
              ))}
            </fieldset>

            <div className="stack tight">
              <button type="button" className="btn primary block" disabled={busy || !project} onClick={run}>
                <Icon name="share" />
                {n}쪽을 GoodNotes · Flexcil로 보내기
              </button>
              <p className="sub" style={{ textAlign: 'center', fontSize: 13 }}>
                공유 시트에서 받을 앱을 고르면 새 노트로 열리거나 기존 노트에 추가돼요.
              </p>
              {status && (
                <p className="notice ok" role="status">
                  {status}
                </p>
              )}
            </div>
          </>
        )}
      </main>
      <TabBar current="export" />
    </>
  );
}
