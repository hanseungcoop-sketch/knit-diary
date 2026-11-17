import { useEffect, useState } from 'react';
import { listPhotos } from '../lib/db';
import { useProjects } from '../lib/hooks';
import type { Photo, Project } from '../lib/types';
import { dotDate, projectPct } from '../lib/util';
import { Icon, PhotoImg, TabBar } from '../components/ui';

function Card({ p }: { p: Project }) {
  const [cover, setCover] = useState<Photo>();
  useEffect(() => {
    listPhotos(p.id).then((ps) => setCover(ps.find((x) => x.inPdf) ?? ps[0]));
  }, [p.id]);
  return (
    <a href={`#/project/${p.id}`} className="card" style={{ padding: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}>
      <div style={{ position: 'relative' }}>
        <PhotoImg photo={cover} w="100%" h={260} />
        <span className="tag" style={{ position: 'absolute', left: 12, top: 12, background: '#fff' }}>
          {p.status === 'done' ? '완성' : `진행 중 ${projectPct(p)}%`}
        </span>
      </div>
      <div className="stack tight" style={{ padding: '16px 18px' }}>
        <h2 className="h3">{p.name || '이름 없는 작품'}</h2>
        <p className="sub">{p.status === 'done' ? `${dotDate(p.startDate)} – ${dotDate(p.endDate)}` : `${dotDate(p.startDate)} 시작`}</p>
      </div>
    </a>
  );
}

export default function Archive() {
  const projects = useProjects();
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  if (!projects) return null;
  const year = new Date().getFullYear();
  const shown = projects.filter((p) => filter === 'all' || p.status === filter);
  const doneThisYear = projects.filter((p) => p.status === 'done' && p.endDate?.startsWith(String(year))).length;
  const counts = { all: projects.length, active: projects.filter((p) => p.status === 'active').length, done: projects.filter((p) => p.status === 'done').length };
  return (
    <>
      <main className="page">
        <header className="stack tight">
          <h1 className="big-title">보관함</h1>
          <p className="sub" style={{ fontSize: 15 }}>
            {year}년 완성 {doneThisYear}벌 · 전체 {projects.length}개 작품
          </p>
        </header>
        <div className="row wrap" role="group" aria-label="필터">
          {(
            [
              ['all', '전체'],
              ['active', '진행 중'],
              ['done', '완성']
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={`chip ${filter === id ? 'on' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} {counts[id]}
            </button>
          ))}
        </div>
        <div className="grid2">
          {shown.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </div>
        <a className="btn dashed block" href="#/new">
          <Icon name="plus" size={20} />
          예전 작품도 기록하기
        </a>
      </main>
      <TabBar current="archive" />
    </>
  );
}
