import type { Gauge, Part, Project } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const dotDate = (s: string | null) => (s ? s.replace(/-/g, '.') : '');
export const shortDate = (s: string) => {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};
export const daysBetween = (a: string, b: string) =>
  Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000) + 1;

export const newPart = (name = '몸판'): Part => ({
  id: uid(),
  name,
  target: 0,
  count: 0,
  repeatLen: 0,
  repeat: 1,
  decStart: 0,
  decEvery: 0,
  decTimes: 0,
  decText: '',
  doneDate: null
});

export const newProject = (): Project => ({
  id: uid(),
  name: '',
  pattern: '',
  source: '',
  size: '',
  chestCm: null,
  audience: '',
  difficulty: 0,
  startDate: ymd(),
  endDate: null,
  status: 'active',
  memo: '',
  yarns: [],
  needles: [],
  gauges: [],
  parts: [newPart('몸판')],
  log: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
});

/** 알림이 울리는 단 목록 */
export const decRows = (p: Part): number[] => {
  if (!p.decStart || !p.decEvery) return p.decStart ? [p.decStart] : [];
  const times = p.decTimes > 0 ? p.decTimes : 50;
  return Array.from({ length: times }, (_, i) => p.decStart + i * p.decEvery);
};

/** 지금 뜰 단(count+1)이 알림 단인지, 다음 알림 단은 몇 단인지 */
export const decInfo = (p: Part) => {
  const rows = decRows(p);
  const now = p.count + 1;
  return { isNow: rows.includes(now), next: rows.find((r) => r > now) ?? null, any: rows.length > 0 };
};

export const partPct = (p: Part) => (p.target > 0 ? Math.min(100, Math.round((p.count / p.target) * 100)) : p.doneDate ? 100 : 0);

export const projectPct = (pr: Project) => {
  const withTarget = pr.parts.filter((p) => p.target > 0);
  if (pr.status === 'done') return 100;
  if (!withTarget.length) return 0;
  const done = withTarget.reduce((a, p) => a + Math.min(p.count, p.target), 0);
  const total = withTarget.reduce((a, p) => a + p.target, 0);
  return Math.round((done / total) * 100);
};

export const lastKnitDate = (pr: Project) => {
  const dates = pr.log.filter((l) => l.rows > 0).map((l) => l.date).sort();
  return dates.length ? dates[dates.length - 1] : null;
};

/** 게이지 차이: 코 기준 퍼센트와 예상 가슴둘레 */
export const gaugeDiff = (g: Gauge, chestCm: number | null) => {
  if (!g.patSt || !g.mySt) return null;
  const pct = Math.round(((g.mySt - g.patSt) / g.patSt) * 100);
  const est = chestCm ? Math.round((chestCm * g.patSt) / g.mySt) : null;
  return { pct, est };
};

export const gaugeText = (st: number | null, row: number | null) =>
  st || row ? `${st ?? '-'}코 ${row ?? '-'}단` : '';
