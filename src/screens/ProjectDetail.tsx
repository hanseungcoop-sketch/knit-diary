import { useRef, useState } from 'react';
import { deletePattern, deleteProject, savePattern, savePhoto, saveProject } from '../lib/db';
import { go, prefs, usePatterns, usePhotos, useProject } from '../lib/hooks';
import { projectIcs } from '../lib/ics';
import { shrinkImage } from '../lib/image';
import { shareFile } from '../lib/share';
import { addPatternFile } from '../lib/patterns';
import type { PatternFile, Photo, Project } from '../lib/types';
import { daysBetween, decInfo, dotDate, gaugeDiff, gaugeText, partPct, projectPct, shortDate, uid, ymd } from '../lib/util';
import { Bar, Icon, PhotoImg } from '../components/ui';

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd style={v ? undefined : { color: 'var(--quiet)' }}>{v || '—'}</dd>
    </div>
  );
}

function Empty({ id, what }: { id: string; what: string }) {
  return (
    <p className="sub">
      아직 {what} 기록이 없어요. <a href={`#/edit/${id}`}>편집에서 추가</a>
    </p>
  );
}

const shortDay = (d: string) => (d === ymd() ? '오늘' : `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`);

function PhotoStrip({ p, photos }: { p: Project; photos: Photo[] }) {
  return (
    <section className="stack tight" aria-label="사진 기록">
      <div className="row between">
        <h2 className="h3">
          사진 <span style={{ fontWeight: 400, color: 'var(--quiet)' }}>{photos.length}장 · 최신순</span>
        </h2>
        {photos.length > 0 && <a href={`#/photos/${p.id}`}>전체 보기</a>}
      </div>
      {photos.length === 0 ? (
        <a className="btn dashed" href={`#/photos/${p.id}`} style={{ minHeight: 72 }}>
          <Icon name="camera" />
          첫 사진 남기기 (실, 도안, 게이지 스와치부터)
        </a>
      ) : (
        <div className="strip">
          {photos.map((ph) => (
            <a key={ph.id} href={`#/photos/${p.id}`} className="strip-item">
              <span style={{ position: 'relative', display: 'block' }}>
                <PhotoImg photo={ph} w={132} h={132} alt={ph.caption || ph.tag} />
                {ph.tag && <span className="ptag small">{ph.tag}</span>}
              </span>
              <span className="sub" style={{ fontSize: 12 }}>
                {shortDay(ph.date)}
                {ph.caption ? ` · ${ph.caption}` : ''}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function PatternList({ p, patterns }: { p: Project; patterns: PatternFile[] }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = async (f?: File) => {
    if (!f) return;
    await addPatternFile(p.id, f);
  };
  const open = (pt: PatternFile) => {
    prefs.set('pattern:' + p.id, pt.id);
    prefs.set('mode:' + p.id, 'pattern');
    go(`counter/${p.id}`);
  };
  return (
    <div className="card stack">
      <div className="row between">
        <h2 className="h3">도안 PDF</h2>
        <button type="button" className="btn dashed" onClick={() => ref.current?.click()}>
          <Icon name="plus" size={18} />
          도안 추가
        </button>
        <input ref={ref} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => add(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      </div>
      {patterns.length === 0 && <p className="sub">파일 앱이나 iCloud Drive에 있는 도안 PDF를 불러와서, 카운터 옆에 띄워놓고 뜰 수 있어요.</p>}
      {patterns.map((pt) => (
        <div key={pt.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <Icon name="pdf" />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pt.name} <span className="sub">· {pt.page}쪽까지 봄</span>
          </span>
          <button type="button" className="btn" onClick={() => open(pt)}>
            열기
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              const name = prompt('도안 이름', pt.name);
              if (name && name.trim()) savePattern({ ...pt, name: name.trim() });
            }}
          >
            이름 변경
          </button>
          <button type="button" className="link-btn" style={{ color: 'var(--danger)' }} aria-label={`${pt.name} 삭제`} onClick={() => confirm(`'${pt.name}' 도안을 앱에서 지울까요? 원본 파일은 그대로 있어요.`) && deletePattern(pt.id)}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ProjectDetail({ id }: { id: string }) {
  const p = useProject(id);
  const photos = usePhotos(id);
  const patterns = usePatterns(id);
  const [tab, setTab] = useState<'progress' | 'materials' | 'record'>(() => (prefs.get('tab') as 'progress' | 'materials' | 'record') || 'progress');
  const [menu, setMenu] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  if (p === undefined || !photos || !patterns) return null;
  if (!p)
    return (
      <main className="page no-tabs">
        <a className="icon-btn" href="#/" aria-label="뒤로">
          <Icon name="back" />
        </a>
        <p>작품을 찾을 수 없어요.</p>
      </main>
    );

  const pct = projectPct(p);
  const days = daysBetween(p.startDate, p.endDate ?? ymd());
  const savedPart = prefs.get('part:' + p.id);
  const cur = p.parts.find((x) => x.id === savedPart && !x.doneDate) ?? p.parts.find((x) => !x.doneDate) ?? p.parts[0];
  const cover = photos.find((x) => x.inPdf) ?? photos[0];

  const byDate = new Map<string, string[]>();
  for (const l of [...p.log].sort((a, b) => b.date.localeCompare(a.date))) {
    if (l.rows <= 0) continue;
    const name = p.parts.find((x) => x.id === l.partId)?.name ?? '삭제된 파트';
    byDate.set(l.date, [...(byDate.get(l.date) ?? []), `${name} +${l.rows}단`]);
  }

  const pickTab = (t: typeof tab) => {
    prefs.set('tab', t);
    setTab(t);
  };
  const toggleDone = async () => {
    setMenu(false);
    if (p.status === 'active') await saveProject({ ...p, status: 'done', endDate: p.endDate ?? ymd() });
    else await saveProject({ ...p, status: 'active', endDate: null });
  };
  const remove = async () => {
    setMenu(false);
    if (!confirm(`'${p.name}' 작품과 사진, 도안을 모두 지울까요? 되돌릴 수 없어요.`)) return;
    await deleteProject(p.id);
    go('');
  };
  const openCounter = (partId: string, withPattern = false) => {
    prefs.set('part:' + p.id, partId);
    if (withPattern) prefs.set('mode:' + p.id, 'pattern');
    go(`counter/${p.id}`);
  };
  const addPhoto = async (f?: File) => {
    if (!f) return;
    const blob = await shrinkImage(f);
    await savePhoto({ id: uid(), projectId: p.id, blob, createdAt: Date.now(), date: ymd(), tag: cur ? `${cur.name} ${cur.count}단` : '', caption: '', inPdf: false });
  };

  return (
    <main className="page no-tabs">
      <header className="row between">
        <a className="icon-btn" href={p.status === 'done' ? '#/archive' : '#/'} aria-label="뒤로">
          <Icon name="back" />
        </a>
        <div className="row" style={{ position: 'relative' }}>
          <a className="btn pill" href={`#/edit/${p.id}`}>
            편집
          </a>
          <button type="button" className="icon-btn" aria-label="더보기" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
          {menu && (
            <div className="menu" role="menu">
              <button type="button" role="menuitem" onClick={toggleDone}>
                <Icon name="check" size={18} />
                {p.status === 'active' ? '완성으로 표시' : '다시 진행 중으로'}
              </button>
              <button type="button" role="menuitem" style={{ color: 'var(--danger)' }} onClick={remove}>
                <Icon name="trash" size={18} />
                작품 삭제
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="card row hero" style={{ alignItems: 'stretch', gap: 22 }}>
        <PhotoImg photo={cover} w={170} h={220} alt="대표 사진" />
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <span className="tag" style={{ alignSelf: 'flex-start' }}>
            {p.status === 'done' ? `완성 · ${days}일 걸림` : `진행 중 · ${days}일째`}
          </span>
          <div className="stack tight">
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>{p.name}</h1>
            <p className="sub" style={{ fontSize: 15 }}>
              {[p.size && `사이즈 ${p.size}`, p.status === 'done' ? `${dotDate(p.startDate)} – ${dotDate(p.endDate)}` : `${dotDate(p.startDate)} 시작`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="stack tight">
            <div className="row between" style={{ fontSize: 14 }}>
              <span>{cur ? `${cur.name} ${cur.count}${cur.target ? ` / ${cur.target}` : ''}단` : ''}</span>
              <b>전체 {pct}%</b>
            </div>
            <Bar pct={pct} />
          </div>
          {p.status === 'active' && cur && (
            <button type="button" className="btn primary" style={{ minHeight: 52, fontSize: 17 }} onClick={() => openCounter(cur.id)}>
              {cur.name} 이어서 뜨기
            </button>
          )}
          <div className="quick">
            <button type="button" className="btn" onClick={() => camRef.current?.click()}>
              <Icon name="camera" size={18} />
              사진 찍기
            </button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addPhoto(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
            <button type="button" className="btn" onClick={() => (patterns.length ? openCounter(cur.id, true) : pickTab('materials'))}>
              <Icon name="pdf" size={18} />
              {patterns.length ? `도안 ${patterns.length}` : '도안 추가'}
            </button>
            <a className="btn" href={`#/export/${p.id}`}>
              <Icon name="share" size={18} />
              PDF
            </a>
            <button type="button" className="btn" onClick={() => shareFile(projectIcs(p), `${p.name || '뜨개'}.ics`, p.name)}>
              <Icon name="calendar" size={18} />
              캘린더
            </button>
          </div>
        </div>
      </section>

      <PhotoStrip p={p} photos={photos} />

      <div className="seg" role="tablist" aria-label="작품 정보 보기">
        {(
          [
            ['progress', '진행'],
            ['materials', '재료 · 정보'],
            ['record', '기록']
          ] as const
        ).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} aria-checked={tab === t} onClick={() => pickTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'progress' && (
        <section className="stack" style={{ gap: 12 }}>
          {p.parts.map((pt) => {
            const d = decInfo(pt);
            const isCur = pt.id === cur?.id && p.status === 'active';
            return (
              <button key={pt.id} type="button" className={`card part-card ${isCur ? 'cur' : ''}`} onClick={() => openCounter(pt.id)} aria-label={`${pt.name} 카운터 열기`}>
                <div className="row between">
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{pt.name}</span>
                  <span style={{ fontSize: 15, color: pt.doneDate ? 'var(--accent-dark)' : undefined, fontWeight: pt.doneDate ? 700 : 400 }}>
                    {pt.doneDate ? `${pt.count}단 · ${shortDay(pt.doneDate)} 완료` : `${pt.count}${pt.target ? ` / ${pt.target}` : ''}단`}
                  </span>
                </div>
                <Bar pct={partPct(pt)} />
                {(pt.repeatLen > 0 || d.any) && !pt.doneDate && (
                  <div className="row wrap" style={{ gap: 8, fontSize: 13 }}>
                    {pt.repeatLen > 0 && <span className="pill-info">무늬 반복 {pt.repeatLen}단 · 지금 {pt.repeat}단째</span>}
                    {d.any && (
                      <span className="pill-info warn">
                        {pt.decStart}단부터{pt.decEvery ? ` ${pt.decEvery}단마다` : ''}
                        {pt.decTimes ? ` ${pt.decTimes}번` : ''}
                        {pt.decText ? ` · ${pt.decText}` : ''}
                      </span>
                    )}
                    {d.isNow && <span className="pill-info ok">지금 뜨는 단이 알림 단</span>}
                    {!d.isNow && d.next && <span className="pill-info ok">다음 알림 {d.next}단 ({d.next - pt.count - 1}단 뒤)</span>}
                  </div>
                )}
              </button>
            );
          })}
          <p className="sub" style={{ fontSize: 13 }}>
            파트를 누르면 그 파트 카운터로 바로 가요.
          </p>
        </section>
      )}

      {tab === 'materials' && (
        <section className="stack" style={{ gap: 14 }}>
          <div className="card">
            <dl className="infogrid three">
              <Info k="도안" v={p.pattern} />
              <Info k="도안 출처" v={p.source} />
              <Info k="사이즈" v={p.size} />
              <Info k="도안 가슴둘레" v={p.chestCm ? `${p.chestCm}cm` : ''} />
              <Info k="사용 대상" v={p.audience} />
              <Info k="난이도" v={p.difficulty ? `${'●'.repeat(p.difficulty)}${'○'.repeat(5 - p.difficulty)}` : ''} />
            </dl>
          </div>

          <PatternList p={p} patterns={patterns} />

          <div className="card stack">
            <h2 className="h3">실</h2>
            {p.yarns.length === 0 ? (
              <Empty id={p.id} what="실" />
            ) : (
              <div className="scroll-x">
                <table className="simple">
                  <thead>
                    <tr>
                      <th>브랜드 · 실 이름</th>
                      <th>색상</th>
                      <th>로트</th>
                      <th>굵기</th>
                      <th>사용량</th>
                      <th>남은 양</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.yarns.map((y, i) => (
                      <tr key={i}>
                        <td>{[y.brand, y.name].filter(Boolean).join(' ') || '—'}</td>
                        <td>{y.color || '—'}</td>
                        <td>{y.lot || '—'}</td>
                        <td>{y.weight || '—'}</td>
                        <td>{y.used || '—'}</td>
                        <td>{y.remaining || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card stack">
            <h2 className="h3">바늘</h2>
            {p.needles.length === 0 ? (
              <Empty id={p.id} what="바늘" />
            ) : (
              <div className="row wrap" style={{ gap: 10 }}>
                {p.needles.map((n, i) => (
                  <span key={i} className="pill-info" style={{ fontSize: 15, padding: '8px 14px' }}>
                    <b>{n.size || '—'}</b> {[n.kind, n.use].filter(Boolean).join(' · ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card stack">
            <h2 className="h3">게이지 (10cm)</h2>
            {p.gauges.length === 0 ? (
              <Empty id={p.id} what="게이지" />
            ) : (
              <div className="scroll-x">
                <table className="simple">
                  <thead>
                    <tr>
                      <th>무늬</th>
                      <th>도안</th>
                      <th>내 게이지</th>
                      <th>결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.gauges.map((g, i) => {
                      const d = gaugeDiff(g, p.chestCm);
                      return (
                        <tr key={i}>
                          <td>{g.pattern || `게이지 ${i + 1}`}</td>
                          <td>{gaugeText(g.patSt, g.patRow) || '—'}</td>
                          <td>{gaugeText(g.mySt, g.myRow) || '—'}</td>
                          <td style={{ fontWeight: 700, color: d && d.pct !== 0 ? '#8a5a00' : 'var(--accent-dark)' }}>
                            {d ? (d.pct === 0 ? '맞음' : `코 ${d.pct > 0 ? '+' : ''}${d.pct}%${d.est ? ` · 가슴 약 ${d.est}cm` : ''}`) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'record' && (
        <section className="stack" style={{ gap: 14 }}>
          <div className="card stack tight">
            <h2 className="h3">메모 · 수정한 부분과 이유</h2>
            {p.memo ? <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{p.memo}</p> : <Empty id={p.id} what="메모" />}
          </div>
          <div className="card stack">
            <h2 className="h3">일지</h2>
            {byDate.size === 0 && <p className="sub">카운터로 뜨면 날짜별로 자동으로 쌓여요.</p>}
            {[...byDate.entries()].slice(0, 60).map(([d, items]) => (
              <div key={d} className="row" style={{ fontSize: 15, alignItems: 'flex-start' }}>
                <span style={{ width: 72, color: 'var(--quiet)', flexShrink: 0 }}>{shortDate(d)}</span>
                <span>{items.join(' · ')}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
