import { useEffect, useRef, useState } from 'react';
import { deletePattern, getProject, saveProject } from '../lib/db';
import { addPatternFile } from '../lib/patterns';
import { go, usePatterns } from '../lib/hooks';
import { emptyGauge, emptyNeedle, emptyYarn, type Gauge, type Part, type Project } from '../lib/types';
import { gaugeDiff, gaugeText, newPart, newProject } from '../lib/util';
import { bySize, foundAnything, yarnFrom, type FoundInfo } from '../lib/patternInfo';
import { Icon, Top } from '../components/ui';

const num = (v: string) => (v.trim() === '' ? null : Number(v));
const int = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

function GaugeNote({ g, chest }: { g: Gauge; chest: number | null }) {
  const d = gaugeDiff(g, chest);
  if (!d) return null;
  if (d.pct === 0) return <p className="notice ok">도안 게이지와 같아요.</p>;
  return (
    <p className="notice warn" role="status">
      내 게이지가 도안보다 코가 {Math.abs(d.pct)}% {d.pct > 0 ? '촘촘해요' : '느슨해요'}.
      {d.est && chest ? ` 이대로 뜨면 가슴둘레 ${chest}cm → 약 ${d.est}cm.` : ' 기본 정보에 도안 가슴둘레를 넣으면 예상 치수를 계산해드려요.'}
    </p>
  );
}

type Scan = { state: 'loading' } | { state: 'none' } | { state: 'found'; info: FoundInfo; file: string };
type Key = 'pattern' | 'size' | 'chest' | 'yarn' | 'needles' | 'gauges';

/** 도안에서 찾은 정보를 보여주고, 고른 것만 채워요 */
function ScanPanel({ scan, p, onApply, onClose }: { scan: Scan; p: Project; onApply: (next: Project) => void; onClose: () => void }) {
  const info = scan.state === 'found' ? scan.info : null;
  const [size, setSize] = useState(() => (info && info.sizes.includes(p.size) ? p.size : info?.sizes[0] ?? p.size));
  const [checks, setChecks] = useState<Record<Key, boolean>>({
    pattern: !p.pattern.trim() || p.pattern === (scan.state === 'found' ? scan.file : ''),
    size: !p.size.trim(),
    chest: !p.chestCm,
    yarn: p.yarns.length === 0,
    needles: p.needles.length === 0,
    gauges: p.gauges.length === 0
  });
  if (scan.state === 'loading') return <p className="notice ok" role="status">도안을 읽고 있어요…</p>;
  if (scan.state === 'none')
    return (
      <div className="notice warn row between wrap" role="status">
        <span>이 PDF에서 정보를 찾지 못했어요. 스캔한 이미지로 된 도안이면 글자를 읽을 수 없어요. 직접 입력해 주세요.</span>
        <button type="button" className="btn" onClick={onClose}>
          닫기
        </button>
      </div>
    );
  const f = info!;
  const chest = bySize(f.chest, f.sizes, size);
  const yarn = yarnFrom(f, size);
  const rows: { key: Key; label: string; value: string; adds?: boolean }[] = [];
  if (f.pattern) rows.push({ key: 'pattern', label: '도안 이름', value: f.pattern });
  if (f.sizes.length) rows.push({ key: 'size', label: '사이즈', value: size });
  if (chest) rows.push({ key: 'chest', label: '도안 가슴둘레', value: `${chest}cm` });
  if (yarn) rows.push({ key: 'yarn', label: '실', value: [yarn.name, yarn.weight, yarn.used && `사용 ${yarn.used}`].filter(Boolean).join(' · '), adds: p.yarns.length > 0 });
  if (f.needles.length) rows.push({ key: 'needles', label: '바늘', value: f.needles.map((n) => [n.size, n.kind].filter(Boolean).join(' ')).join(', '), adds: p.needles.length > 0 });
  if (f.gauges.length) rows.push({ key: 'gauges', label: '게이지 (도안)', value: f.gauges.map((g) => [g.pattern, gaugeText(g.patSt, g.patRow)].filter(Boolean).join(' ')).join(' / '), adds: p.gauges.length > 0 });

  const apply = () => {
    const next = { ...p };
    if (checks.pattern && f.pattern) {
      // 작품명이 파일 이름으로만 채워져 있었다면 도안 이름으로 바꿔요
      if (!p.name.trim() || p.name === p.pattern) next.name = f.pattern;
      next.pattern = f.pattern;
    }
    if (checks.size && f.sizes.length) next.size = size;
    if (checks.chest && chest) next.chestCm = chest;
    if (checks.yarn && yarn) next.yarns = [...p.yarns, yarn];
    if (checks.needles) next.needles = [...p.needles, ...f.needles];
    if (checks.gauges) next.gauges = [...p.gauges, ...f.gauges];
    onApply(next);
  };

  return (
    <div className="scan stack" role="region" aria-label="도안에서 찾은 정보">
      <div className="row between wrap">
        <h3 className="h3">도안에서 찾은 정보</h3>
        {f.sizes.length > 1 && (
          <label className="row" style={{ gap: 8, fontSize: 15 }}>
            내 사이즈
            <select value={size} onChange={(e) => setSize(e.target.value)} style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--field)', padding: '0 10px', fontSize: 16 }}>
              {f.sizes.map((sz) => (
                <option key={sz}>{sz}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="sub" style={{ fontSize: 13 }}>
        체크한 항목만 채워요. 이미 입력한 칸은 기본으로 체크하지 않았어요. 채운 뒤에도 아래에서 고칠 수 있어요.
      </p>
      {rows.map((r) => (
        <label key={r.key} className="scan-row">
          <input type="checkbox" checked={checks[r.key]} onChange={(e) => setChecks({ ...checks, [r.key]: e.target.checked })} />
          <span className="k">{r.label}</span>
          <span className="v">
            {r.value}
            {r.adds && <span className="sub"> · 기존 기록에 추가</span>}
          </span>
        </label>
      ))}
      <div className="row">
        <button type="button" className="btn primary" onClick={apply} disabled={!rows.some((r) => checks[r.key])}>
          선택한 항목 채우기
        </button>
        <button type="button" className="btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

export default function ProjectEdit({ id }: { id?: string }) {
  const [p, setP] = useState<Project | null>(id ? null : newProject());
  const [pending, setPending] = useState<File[]>([]); // 저장할 때 붙일 도안 PDF
  const [saving, setSaving] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const existing = usePatterns(id ?? '-');
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanKey, setScanKey] = useState(0);

  /** 고른 PDF들에서 차례로 정보를 찾아요 */
  const runScan = async (blobs: { blob: Blob; name: string }[]) => {
    if (!blobs.length) return;
    setScan({ state: 'loading' });
    try {
      const [{ pdfLines }, { parsePatternText }] = await Promise.all([import('../lib/pdfText'), import('../lib/patternInfo')]);
      for (const b of blobs) {
        const info = parsePatternText(await pdfLines(b.blob));
        if (foundAnything(info)) {
          setScanKey((k) => k + 1);
          setScan({ state: 'found', info, file: b.name });
          return;
        }
      }
      setScan({ state: 'none' });
    } catch {
      setScan({ state: 'none' });
    }
  };
  useEffect(() => {
    if (id) getProject(id).then((x) => x && setP(structuredClone(x)));
  }, [id]);
  if (!p) return null;

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP({ ...p, [k]: v });
  const setItem = <K extends 'yarns' | 'needles' | 'gauges' | 'parts'>(k: K, i: number, patch: Partial<Project[K][number]>) =>
    setP({ ...p, [k]: p[k].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const remove = (k: 'yarns' | 'needles' | 'gauges' | 'parts', i: number) => setP({ ...p, [k]: p[k].filter((_, j) => j !== i) });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const out = { ...p, name: p.name.trim() || '이름 없는 작품' };
    if (out.parts.length === 0) out.parts = [newPart('몸판')];
    await saveProject(out);
    for (const f of pending) await addPatternFile(out.id, f);
    go(`project/${out.id}`);
  };

  const addPdfs = (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!list.length) return;
    setPending([...pending, ...list]);
    // 도안 이름이 비어 있으면 첫 파일 이름으로 채워요
    const fileName = list[0].name.replace(/\.pdf$/i, '');
    if (!p.pattern.trim() || !p.name.trim()) setP({ ...p, pattern: p.pattern.trim() || fileName, name: p.name.trim() || fileName });
    runScan(list.map((f) => ({ blob: f, name: f.name.replace(/\.pdf$/i, '') })));
  };

  return (
    <main className="page no-tabs">
      <Top
        back={id ? `#/project/${id}` : '#/'}
        title={id ? '작품 편집' : '새 작품'}
        right={
          <button type="button" className="btn primary" onClick={save} disabled={saving}>
            저장
          </button>
        }
      />

      <section className="card stack">
        <div className="row between">
          <div className="stack tight">
            <h2 className="h2">{id ? '도안 PDF' : '1. 도안 PDF부터 불러오기'}</h2>
            {!id && <p className="sub">도안에 적힌 사이즈·실·바늘·게이지를 읽어서 아래 칸을 채워드려요. 도안이 없으면 건너뛰고 직접 입력하세요.</p>}
          </div>
          <button type="button" className={`btn ${!id && !pending.length ? 'primary' : 'dashed'}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => pdfRef.current?.click()}>
            <Icon name="plus" size={18} />
            도안 PDF 불러오기
          </button>
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { addPdfs(e.target.files); e.target.value = ''; }} />
        </div>
        {!existing?.length && !pending.length && <p className="sub" style={{ fontSize: 13 }}>파일 앱, iCloud Drive, 다운로드 폴더에서 고를 수 있어요. 본 도안과 사이즈표처럼 여러 개를 넣어도 돼요. 넣은 도안은 카운터 옆에 띄워놓고 볼 수 있어요.</p>}
        {existing?.map((pt) => (
          <div key={pt.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <Icon name="pdf" />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.name}</span>
            <button type="button" className="link-btn" style={{ color: 'var(--danger)' }} onClick={() => confirm(`'${pt.name}' 도안을 앱에서 지울까요? 원본 파일은 그대로 있어요.`) && deletePattern(pt.id)}>
              삭제
            </button>
          </div>
        ))}
        {pending.map((f, i) => (
          <div key={i} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <Icon name="pdf" />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.name.replace(/\.pdf$/i, '')} <span className="sub">· 저장하면 붙어요</span>
            </span>
            <button type="button" className="link-btn" style={{ color: 'var(--danger)' }} onClick={() => setPending(pending.filter((_, j) => j !== i))}>
              빼기
            </button>
          </div>
        ))}
        {(existing?.length || pending.length) && !scan ? (
          <button
            type="button"
            className="btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => runScan([...pending.map((f) => ({ blob: f as Blob, name: f.name.replace(/\.pdf$/i, '') })), ...(existing ?? []).map((x) => ({ blob: x.blob, name: x.name }))])}
          >
            도안에서 정보 가져오기
          </button>
        ) : null}
        {scan && <ScanPanel key={scanKey} scan={scan} p={p} onApply={(next) => { setP(next); setScan(null); }} onClose={() => setScan(null)} />}
      </section>

      <section className="card stack">
        <h2 className="h2">{id ? '기본 정보' : '2. 기본 정보'}</h2>
        <div className="fields">
          <label className="field full">
            작품명
            <input value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 코렌스웨터" />
          </label>
          <label className="field">
            도안 이름
            <input value={p.pattern} onChange={(e) => set('pattern', e.target.value)} />
          </label>
          <label className="field">
            도안 출처
            <input value={p.source} onChange={(e) => set('source', e.target.value)} placeholder="예: 코실니트" />
          </label>
          <label className="field">
            사이즈
            <input value={p.size} onChange={(e) => set('size', e.target.value)} placeholder="예: M" />
          </label>
          <label className="field">
            도안 가슴둘레 (cm)
            <input inputMode="decimal" value={p.chestCm ?? ''} onChange={(e) => set('chestCm', num(e.target.value))} />
          </label>
          <label className="field">
            사용 대상
            <input value={p.audience} onChange={(e) => set('audience', e.target.value)} placeholder="예: 나, 남편" />
          </label>
          <label className="field">
            난이도 (0–5)
            <select value={p.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? '선택 안 함' : '●'.repeat(n)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            시작일
            <input type="date" value={p.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </label>
          <label className="field">
            완성일
            <input type="date" value={p.endDate ?? ''} onChange={(e) => setP({ ...p, endDate: e.target.value || null, status: e.target.value ? 'done' : 'active' })} />
          </label>
        </div>
      </section>

      <section className="card stack">
        <div className="row between">
          <h2 className="h2">실</h2>
          <button type="button" className="btn dashed" onClick={() => set('yarns', [...p.yarns, emptyYarn()])}>
            <Icon name="plus" size={18} />실 추가
          </button>
        </div>
        {p.yarns.map((y, i) => (
          <div className="sublist" key={i}>
            <div className="fields">
              <label className="field">
                브랜드
                <input value={y.brand} onChange={(e) => setItem('yarns', i, { brand: e.target.value })} placeholder="예: 박씨네" />
              </label>
              <label className="field">
                실 이름
                <input value={y.name} onChange={(e) => setItem('yarns', i, { name: e.target.value })} placeholder="예: 램스울" />
              </label>
              <label className="field">
                색상명·번호
                <input value={y.color} onChange={(e) => setItem('yarns', i, { color: e.target.value })} />
              </label>
              <label className="field">
                로트
                <input value={y.lot} onChange={(e) => setItem('yarns', i, { lot: e.target.value })} />
              </label>
              <label className="field">
                굵기·합
                <input value={y.weight} onChange={(e) => setItem('yarns', i, { weight: e.target.value })} placeholder="예: 6합" />
              </label>
              <label className="field">
                사용량
                <input value={y.used} onChange={(e) => setItem('yarns', i, { used: e.target.value })} placeholder="예: 422g" />
              </label>
              <label className="field">
                남은 양
                <input value={y.remaining} onChange={(e) => setItem('yarns', i, { remaining: e.target.value })} />
              </label>
            </div>
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => remove('yarns', i)}>
              이 실 삭제
            </button>
          </div>
        ))}
      </section>

      <section className="card stack">
        <div className="row between">
          <h2 className="h2">바늘</h2>
          <button type="button" className="btn dashed" onClick={() => set('needles', [...p.needles, emptyNeedle()])}>
            <Icon name="plus" size={18} />바늘 추가
          </button>
        </div>
        {p.needles.map((n, i) => (
          <div className="fields three" key={i}>
            <label className="field">
              호수
              <input value={n.size} onChange={(e) => setItem('needles', i, { size: e.target.value })} placeholder="예: 5mm" />
            </label>
            <label className="field">
              종류
              <input value={n.kind} onChange={(e) => setItem('needles', i, { kind: e.target.value })} placeholder="예: 조립식 80cm" />
            </label>
            <label className="field">
              용도
              <span className="row">
                <input value={n.use} onChange={(e) => setItem('needles', i, { use: e.target.value })} placeholder="예: 몸판" />
                <button type="button" className="icon-btn" aria-label="이 바늘 삭제" onClick={() => remove('needles', i)}>
                  <Icon name="trash" size={18} />
                </button>
              </span>
            </label>
          </div>
        ))}
      </section>

      <section className="card stack">
        <div className="row between">
          <h2 className="h2">게이지 (10 × 10cm)</h2>
          <button type="button" className="btn dashed" onClick={() => set('gauges', [...p.gauges, emptyGauge()])}>
            <Icon name="plus" size={18} />게이지 추가
          </button>
        </div>
        {p.gauges.map((g, i) => (
          <div className="sublist" key={i}>
            <label className="field">
              무늬 이름
              <input value={g.pattern} onChange={(e) => setItem('gauges', i, { pattern: e.target.value })} placeholder="예: 두코 멍석 무늬" />
            </label>
            <div className="fields four">
              <label className="field">
                도안 코
                <input inputMode="decimal" value={g.patSt ?? ''} onChange={(e) => setItem('gauges', i, { patSt: num(e.target.value) })} />
              </label>
              <label className="field">
                도안 단
                <input inputMode="decimal" value={g.patRow ?? ''} onChange={(e) => setItem('gauges', i, { patRow: num(e.target.value) })} />
              </label>
              <label className="field">
                내 코
                <input inputMode="decimal" value={g.mySt ?? ''} onChange={(e) => setItem('gauges', i, { mySt: num(e.target.value) })} />
              </label>
              <label className="field">
                내 단
                <input inputMode="decimal" value={g.myRow ?? ''} onChange={(e) => setItem('gauges', i, { myRow: num(e.target.value) })} />
              </label>
            </div>
            <GaugeNote g={g} chest={p.chestCm} />
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => remove('gauges', i)}>
              이 게이지 삭제
            </button>
          </div>
        ))}
      </section>

      <section className="card stack">
        <div className="row between">
          <h2 className="h2">파트 나누기</h2>
          <button type="button" className="btn dashed" onClick={() => set('parts', [...p.parts, newPart(`파트 ${p.parts.length + 1}`)])}>
            <Icon name="plus" size={18} />파트 추가
          </button>
        </div>
        <p className="sub">파트마다 단수 카운터가 따로 있어요. 코 줄임·늘림처럼 정해진 단에 알림을 받을 수 있어요.</p>
        {p.parts.map((pt: Part, i) => (
          <div className="sublist" key={pt.id}>
            <div className="fields three">
              <label className="field">
                파트 이름
                <input value={pt.name} onChange={(e) => setItem('parts', i, { name: e.target.value })} />
              </label>
              <label className="field">
                목표 단수
                <input inputMode="numeric" value={pt.target || ''} onChange={(e) => setItem('parts', i, { target: int(e.target.value) })} placeholder="모르면 비워두기" />
              </label>
              <label className="field">
                무늬 반복 단수
                <input inputMode="numeric" value={pt.repeatLen || ''} onChange={(e) => setItem('parts', i, { repeatLen: int(e.target.value), repeat: 1 })} placeholder="예: 8" />
              </label>
            </div>
            <div className="fields four">
              <label className="field">
                알림 시작 단
                <input inputMode="numeric" value={pt.decStart || ''} onChange={(e) => setItem('parts', i, { decStart: int(e.target.value) })} placeholder="예: 76" />
              </label>
              <label className="field">
                몇 단마다
                <input inputMode="numeric" value={pt.decEvery || ''} onChange={(e) => setItem('parts', i, { decEvery: int(e.target.value) })} placeholder="예: 12" />
              </label>
              <label className="field">
                몇 번
                <input inputMode="numeric" value={pt.decTimes || ''} onChange={(e) => setItem('parts', i, { decTimes: int(e.target.value) })} placeholder="예: 4" />
              </label>
              <label className="field">
                알림 문구
                <input value={pt.decText} onChange={(e) => setItem('parts', i, { decText: e.target.value })} placeholder="양쪽 1코 줄임" />
              </label>
            </div>
            {p.parts.length > 1 && (
              <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => remove('parts', i)}>
                이 파트 삭제
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2 className="h2">메모 · 수정한 부분과 이유</h2>
        <label className="field">
          <span className="sr-only">메모</span>
          <textarea value={p.memo} onChange={(e) => set('memo', e.target.value)} />
        </label>
      </section>

      <button type="button" className="btn primary block" onClick={save} disabled={saving}>
        {saving ? '저장하는 중…' : '저장'}
      </button>
    </main>
  );
}
