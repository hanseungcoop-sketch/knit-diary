import { useEffect, useState } from 'react';
import { getMeta, listPhotos } from '../lib/db';
import { useProjects } from '../lib/hooks';
import type { Photo, Project } from '../lib/types';
import { decInfo, dotDate, lastKnitDate, parseYmd, projectPct, shortDate, ymd } from '../lib/util';
import { Bar, Icon, PhotoImg, TabBar } from '../components/ui';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function useCover(id: string) {
  const [p, setP] = useState<Photo>();
  useEffect(() => {
    listPhotos(id).then((ps) => setP(ps.find((x) => x.inPdf) ?? ps[0]));
  }, [id]);
  return p;
}

function ActiveCard({ p }: { p: Project }) {
  const cover = useCover(p.id);
  const part = p.parts.find((x) => !x.doneDate) ?? p.parts[0];
  const pct = projectPct(p);
  const last = lastKnitDate(p);
  const d = part ? decInfo(part) : null;
  return (
    <div className="card row" style={{ alignItems: 'stretch', gap: 22 }}>
      <PhotoImg photo={cover} w={170} h={210} />
      <div className="stack" style={{ flex: 1, minWidth: 0 }}>
        <div className="stack tight">
          <h3 style={{ fontSize: 22 }}>{p.name || '이름 없는 작품'}</h3>
          <p className="sub">{[p.size && `${p.size} 사이즈`, p.yarns[0] && [p.yarns[0].brand, p.yarns[0].name].filter(Boolean).join(' '), p.needles.map((n) => n.size).filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}</p>
        </div>
        {part && (
          <div className="stack tight">
            <div className="row between" style={{ fontSize: 14 }}>
              <span>
                {part.name} {part.count}
                {part.target ? ` / ${part.target}` : ''}단
              </span>
              <b>전체 {pct}%</b>
            </div>
            <Bar pct={pct} />
          </div>
        )}
        <p className="sub">
          {[d?.isNow ? `이번 단: ${part.decText || '알림'}` : d?.next ? `다음 알림까지 ${d.next - part.count - 1}단` : '', last ? `마지막으로 뜬 날 ${last === ymd() ? '오늘' : shortDate(last)}` : '아직 기록 없음']
            .filter(Boolean)
            .join(' · ')}
        </p>
        <div className="row" style={{ marginTop: 'auto' }}>
          <a className="btn primary" style={{ flex: 1 }} href={`#/counter/${p.id}`}>
            이어서 뜨기
          </a>
          <a className="btn" href={`#/project/${p.id}`}>
            상세 보기
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const projects = useProjects();
  const [lastBackup, setLastBackup] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    getMeta<string>('lastBackup').then((v) => setLastBackup(v ?? null));
  }, [projects]);

  if (!projects) return null;
  const active = projects.filter((p) => p.status === 'active');
  const done = projects.filter((p) => p.status === 'done').slice(0, 3);
  const today = new Date();

  // 최근 7일 동안 뜬 단수
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const key = ymd(d);
    const rows = projects.reduce((a, p) => a + p.log.filter((l) => l.date === key).reduce((s, l) => s + l.rows, 0), 0);
    return { key, day: d.getDate(), rows };
  });
  const maxRows = Math.max(1, ...week.map((w) => w.rows));
  const needBackup = projects.length > 0 && lastBackup !== undefined && (!lastBackup || (today.getTime() - parseYmd(lastBackup).getTime()) / 86400000 >= 7);

  return (
    <>
      <main className="page">
        <header className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="stack tight">
            <p className="sub" style={{ fontSize: 15 }}>
              {today.getMonth() + 1}월 {today.getDate()}일 {WEEKDAYS[today.getDay()]}요일
            </p>
            <h1 className="big-title">오늘도 한 단씩</h1>
          </div>
          <a className="btn primary pill" href="#/new">
            <Icon name="plus" size={18} />새 작품
          </a>
        </header>

        {needBackup && (
          <div className="notice warn row between wrap">
            <span>{lastBackup ? `마지막 백업이 ${dotDate(lastBackup)}이에요.` : '아직 백업한 적이 없어요.'} 기록을 지키려면 백업 파일을 만들어 두세요.</span>
            <a className="btn" href="#/settings">
              백업하기
            </a>
          </div>
        )}

        <section className="stack">
          <h2 className="h2">진행 중</h2>
          {active.length === 0 && (
            <div className="card empty">
              <p>진행 중인 작품이 없어요.</p>
              <a className="btn primary" href="#/new">
                첫 작품 기록하기
              </a>
            </div>
          )}
          {active.map((p) => (
            <ActiveCard key={p.id} p={p} />
          ))}
        </section>

        <section className="stack">
          <div className="row between">
            <h2 className="h2">최근 7일 뜬 날</h2>
            <a href="#/calendar">캘린더 보기</a>
          </div>
          <div className="card week">
            {week.map((w) => (
              <span key={w.key} style={w.key === ymd() ? { color: 'var(--ink)', fontWeight: 700 } : undefined}>
                {w.day}
              </span>
            ))}
            {week.map((w) => (
              <span
                key={'c' + w.key}
                className="cell"
                title={`${w.rows}단`}
                style={w.rows ? { background: w.rows / maxRows > 0.5 ? 'var(--accent)' : '#a9bfa8' } : undefined}
              />
            ))}
          </div>
          <p className="sub" style={{ fontSize: 13 }}>
            진한 칸일수록 많이 뜬 날이에요.
          </p>
        </section>

        {done.length > 0 && (
          <section className="stack">
            <div className="row between">
              <h2 className="h2">최근 완성</h2>
              <a href="#/archive">보관함 전체</a>
            </div>
            {done.map((p) => (
              <a key={p.id} className="card flat row" href={`#/project/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="stack tight" style={{ flex: 1 }}>
                  <h3 className="h3">{p.name}</h3>
                  <p className="sub">
                    {dotDate(p.startDate)} – {dotDate(p.endDate)}
                  </p>
                </div>
                <Icon name="next" />
              </a>
            ))}
          </section>
        )}
      </main>
      <TabBar current="home" />
    </>
  );
}
