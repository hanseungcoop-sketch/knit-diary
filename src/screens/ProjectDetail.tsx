import { deleteProject, saveProject } from '../lib/db';
import { go, usePhotos, useProject } from '../lib/hooks';
import { projectIcs } from '../lib/ics';
import { shareFile } from '../lib/share';
import { daysBetween, dotDate, gaugeDiff, gaugeText, partPct, projectPct, shortDate, ymd } from '../lib/util';
import { Bar, Icon, Top } from '../components/ui';

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

export default function ProjectDetail({ id }: { id: string }) {
  const p = useProject(id);
  const photos = usePhotos(id);
  if (p === undefined) return null;
  if (!p)
    return (
      <main className="page no-tabs">
        <Top back="#/" title="작품을 찾을 수 없어요" />
      </main>
    );

  const pct = projectPct(p);
  const days = daysBetween(p.startDate, p.endDate ?? ymd());
  const nextPart = p.parts.find((x) => !x.doneDate) ?? p.parts[0];

  // 날짜별 일지
  const byDate = new Map<string, string[]>();
  for (const l of [...p.log].sort((a, b) => b.date.localeCompare(a.date))) {
    if (l.rows <= 0) continue;
    const name = p.parts.find((x) => x.id === l.partId)?.name ?? '삭제된 파트';
    byDate.set(l.date, [...(byDate.get(l.date) ?? []), `${name} +${l.rows}단`]);
  }

  const toggleDone = async () => {
    if (p.status === 'active') await saveProject({ ...p, status: 'done', endDate: p.endDate ?? ymd() });
    else await saveProject({ ...p, status: 'active', endDate: null });
  };
  const remove = async () => {
    if (!confirm(`'${p.name}' 작품과 사진을 모두 지울까요? 되돌릴 수 없어요.`)) return;
    await deleteProject(p.id);
    go('');
  };

  return (
    <main className="page no-tabs">
      <Top
        back={p.status === 'done' ? '#/archive' : '#/'}
        title={p.name}
        sub={`${dotDate(p.startDate)} 시작 · ${p.status === 'done' ? `${dotDate(p.endDate)} 완성 · ${days}일` : `${days}일째`}${p.size ? ` · ${p.size}` : ''}`}
        right={
          <a className="btn pill" href={`#/edit/${p.id}`}>
            편집
          </a>
        }
      />

      <section className="card stack">
        <div className="row between">
          <h2 className="h2">파트별 진행</h2>
          <b>전체 {pct}%</b>
        </div>
        <div className="stack">
          {p.parts.map((pt) => (
            <div key={pt.id} className="row" style={{ fontSize: 15 }}>
              <span style={{ width: 96, flexShrink: 0 }}>{pt.name}</span>
              <div style={{ flex: 1 }}>
                <Bar pct={partPct(pt)} />
              </div>
              <span style={{ width: 110, textAlign: 'right', color: pt.doneDate ? 'var(--accent-dark)' : undefined }}>
                {pt.doneDate ? '완료' : `${pt.count}${pt.target ? ` / ${pt.target}` : ''}단`}
              </span>
            </div>
          ))}
        </div>
        {p.status === 'active' && nextPart && (
          <a className="btn primary block" href={`#/counter/${p.id}`}>
            {nextPart.name} 이어서 뜨기
          </a>
        )}
      </section>

      <section className="grid2">
        <a className="btn" href={`#/photos/${p.id}`}>
          <Icon name="image" />
          사진 기록 {photos?.length ?? 0}장
        </a>
        <a className="btn" href={`#/export/${p.id}`}>
          <Icon name="pdf" />
          PDF로 내보내기
        </a>
        <button type="button" className="btn" onClick={() => shareFile(projectIcs(p), `${p.name || '뜨개'}.ics`, p.name)}>
          <Icon name="calendar" />
          캘린더에 기간 추가
        </button>
        <button type="button" className="btn" onClick={toggleDone}>
          <Icon name="check" />
          {p.status === 'active' ? '완성으로 표시' : '다시 진행 중으로'}
        </button>
      </section>

      <section className="card stack">
        <h2 className="h2">작품 정보</h2>
        <dl className="info">
          <Info k="도안" v={p.pattern} />
          <Info k="도안 출처" v={p.source} />
          <Info k="사이즈" v={p.size} />
          <Info k="도안 가슴둘레" v={p.chestCm ? `${p.chestCm}cm` : ''} />
          <Info k="사용 대상" v={p.audience} />
          <Info k="난이도" v={p.difficulty ? `${'●'.repeat(p.difficulty)}${'○'.repeat(5 - p.difficulty)}` : ''} />
          <Info k="시작일" v={dotDate(p.startDate)} />
          <Info k="완성일" v={p.endDate ? `${dotDate(p.endDate)} (${days}일)` : '진행 중'} />
        </dl>
      </section>

      <section className="card stack">
        <h2 className="h2">실</h2>
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
      </section>

      <section className="grid2">
        <div className="card stack">
          <h2 className="h2">바늘</h2>
          {p.needles.length === 0 ? (
            <Empty id={p.id} what="바늘" />
          ) : (
            <table className="simple">
              <thead>
                <tr>
                  <th>호수</th>
                  <th>종류</th>
                  <th>용도</th>
                </tr>
              </thead>
              <tbody>
                {p.needles.map((n, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{n.size || '—'}</td>
                    <td>{n.kind || '—'}</td>
                    <td>{n.use || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card stack">
          <h2 className="h2">게이지 (10cm)</h2>
          {p.gauges.length === 0 ? (
            <Empty id={p.id} what="게이지" />
          ) : (
            p.gauges.map((g, i) => {
              const d = gaugeDiff(g, p.chestCm);
              return (
                <div key={i} className="stack tight">
                  <p style={{ fontWeight: 700 }}>{g.pattern || `게이지 ${i + 1}`}</p>
                  <p>
                    도안 {gaugeText(g.patSt, g.patRow) || '—'} · 내 {gaugeText(g.mySt, g.myRow) || '—'}
                  </p>
                  {d && (
                    <p className="sub" style={{ color: d.pct !== 0 ? '#8a5a00' : 'var(--accent-dark)', fontWeight: 700 }}>
                      {d.pct === 0 ? '도안과 같아요' : `코 ${d.pct > 0 ? '+' : ''}${d.pct}%${d.est ? ` · 예상 가슴둘레 약 ${d.est}cm` : ''}`}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="card stack">
        <h2 className="h2">파트 설정</h2>
        <div className="scroll-x">
          <table className="simple">
            <thead>
              <tr>
                <th>파트</th>
                <th>목표</th>
                <th>무늬 반복</th>
                <th>알림</th>
              </tr>
            </thead>
            <tbody>
              {p.parts.map((pt) => (
                <tr key={pt.id}>
                  <td style={{ fontWeight: 700 }}>{pt.name}</td>
                  <td>{pt.target ? `${pt.target}단` : '—'}</td>
                  <td>{pt.repeatLen ? `${pt.repeatLen}단` : '—'}</td>
                  <td>
                    {pt.decStart
                      ? `${pt.decStart}단부터${pt.decEvery ? ` ${pt.decEvery}단마다` : ''}${pt.decTimes ? ` ${pt.decTimes}번` : ''}${pt.decText ? ` · ${pt.decText}` : ''}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack tight">
        <h2 className="h2">메모 · 수정한 부분과 이유</h2>
        {p.memo ? <p style={{ whiteSpace: 'pre-wrap' }}>{p.memo}</p> : <Empty id={p.id} what="메모" />}
      </section>

      <section className="stack">
        <h2 className="h2">일지</h2>
        {byDate.size === 0 && <p className="sub">카운터로 뜨면 날짜별로 자동으로 쌓여요.</p>}
        {[...byDate.entries()].slice(0, 30).map(([d, items]) => (
          <div key={d} className="row" style={{ fontSize: 15, alignItems: 'flex-start' }}>
            <span style={{ width: 72, color: 'var(--quiet)', flexShrink: 0 }}>{shortDate(d)}</span>
            <span>{items.join(' · ')}</span>
          </div>
        ))}
      </section>

      <button type="button" className="btn danger" onClick={remove} style={{ alignSelf: 'flex-start' }}>
        <Icon name="trash" size={18} />
        작품 삭제
      </button>
    </main>
  );
}
