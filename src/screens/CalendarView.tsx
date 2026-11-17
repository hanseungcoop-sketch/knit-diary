import { useState } from 'react';
import { useProjects } from '../lib/hooks';
import { shortDate, ymd } from '../lib/util';
import { Icon, TabBar } from '../components/ui';

export default function CalendarView() {
  const projects = useProjects();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(ymd());
  if (!projects) return null;

  const first = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const key = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const rowsOn = (k: string) => projects.reduce((a, p) => a + p.log.filter((l) => l.date === k).reduce((s, l) => s + l.rows, 0), 0);
  const inAny = (k: string) => projects.some((p) => k >= p.startDate && k <= (p.endDate ?? ymd()));
  const move = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  const selItems = projects.flatMap((p) =>
    p.log
      .filter((l) => l.date === sel && l.rows > 0)
      .map((l) => ({ key: p.id + l.partId, text: `${p.name} · ${p.parts.find((x) => x.id === l.partId)?.name ?? ''}`, rows: l.rows }))
  );

  return (
    <>
      <main className="page">
        <header className="row between">
          <h1 className="big-title">
            {ym.y}년 {ym.m + 1}월
          </h1>
          <div className="row">
            <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => move(-1)}>
              <Icon name="back" />
            </button>
            <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => move(1)}>
              <Icon name="next" />
            </button>
          </div>
        </header>

        <div className="card">
          <div className="cal">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <span key={d} className="dow">
                {d}
              </span>
            ))}
            {Array.from({ length: first }, (_, i) => (
              <span key={'b' + i} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const k = key(i + 1);
              const rows = rowsOn(k);
              return (
                <button key={k} type="button" className={sel === k ? 'sel' : ''} onClick={() => setSel(k)} aria-label={`${i + 1}일${rows ? `, ${rows}단` : ''}`}>
                  <span style={{ fontWeight: k === ymd() ? 700 : 400 }}>{i + 1}</span>
                  <span className="band" style={{ background: inAny(k) ? '#a9bfa8' : 'transparent' }} />
                  <span className="dot" style={{ background: rows ? 'var(--accent)' : 'transparent' }} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="row sub" style={{ fontSize: 13, gap: 20 }}>
          <span className="row" style={{ gap: 6 }}>
            <span style={{ width: 24, height: 6, borderRadius: 3, background: '#a9bfa8' }} />
            작품 기간
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--accent)' }} />
            뜬 날
          </span>
        </div>

        <section className="stack">
          <h2 className="h3">{shortDate(sel)}</h2>
          {selItems.length === 0 && <p className="sub">이날 기록이 없어요.</p>}
          {selItems.map((it) => (
            <div key={it.key} className="card flat row between">
              <span>{it.text}</span>
              <b>+{it.rows}단</b>
            </div>
          ))}
        </section>
        <p className="sub" style={{ fontSize: 13 }}>
          아이패드 캘린더에 작품 기간을 넣으려면 작품 상세에서 '캘린더에 기간 추가'를 누르세요.
        </p>
      </main>
      <TabBar current="calendar" />
    </>
  );
}
