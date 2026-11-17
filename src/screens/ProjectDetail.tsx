import { deleteProject, saveProject } from '../lib/db';
import { go, usePhotos, useProject } from '../lib/hooks';
import { projectIcs } from '../lib/ics';
import { shareFile } from '../lib/share';
import { daysBetween, dotDate, gaugeDiff, gaugeText, partPct, projectPct, shortDate, ymd } from '../lib/util';
import { Bar, Icon, Top } from '../components/ui';

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

      {(p.yarns.length > 0 || p.needles.length > 0) && (
        <section className="grid2">
          <div className="card stack tight">
            <h2 className="h3">실</h2>
            {p.yarns.length === 0 && <p className="sub">기록 없음</p>}
            {p.yarns.map((y, i) => (
              <div key={i} className="stack tight">
                <p>{[y.brand, y.name, y.weight].filter(Boolean).join(' ')}</p>
                <p className="sub">{[y.color, y.lot && `로트 ${y.lot}`, y.used && `사용 ${y.used}`, y.remaining && `남음 ${y.remaining}`].filter(Boolean).join(' · ')}</p>
              </div>
            ))}
          </div>
          <div className="card stack tight">
            <h2 className="h3">바늘</h2>
            {p.needles.length === 0 && <p className="sub">기록 없음</p>}
            {p.needles.map((n, i) => (
              <p key={i}>
                {n.size} <span className="sub">{[n.kind, n.use].filter(Boolean).join(' · ')}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {p.gauges.length > 0 && (
        <section className="card stack">
          <h2 className="h3">게이지 (10cm)</h2>
          <table className="simple">
            <thead>
              <tr>
                <th>무늬</th>
                <th>도안</th>
                <th>내 게이지</th>
                <th>차이</th>
              </tr>
            </thead>
            <tbody>
              {p.gauges.map((g, i) => {
                const d = gaugeDiff(g, p.chestCm);
                return (
                  <tr key={i}>
                    <td>{g.pattern}</td>
                    <td>{gaugeText(g.patSt, g.patRow)}</td>
                    <td>{gaugeText(g.mySt, g.myRow)}</td>
                    <td style={{ fontWeight: 700, color: d && d.pct !== 0 ? '#8a5a00' : 'var(--accent-dark)' }}>{d ? (d.pct === 0 ? '맞음' : `코 ${d.pct > 0 ? '+' : ''}${d.pct}%`) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {p.memo && (
        <section className="card stack tight">
          <h2 className="h3">메모</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{p.memo}</p>
        </section>
      )}

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
