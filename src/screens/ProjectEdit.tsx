import { useEffect, useRef, useState } from 'react';
import { deletePattern, getProject, saveProject } from '../lib/db';
import { addPatternFile } from '../lib/patterns';
import { go, usePatterns } from '../lib/hooks';
import { emptyGauge, emptyNeedle, emptyYarn, type Gauge, type Part, type Project } from '../lib/types';
import { gaugeDiff, newPart, newProject } from '../lib/util';
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

export default function ProjectEdit({ id }: { id?: string }) {
  const [p, setP] = useState<Project | null>(id ? null : newProject());
  const [pending, setPending] = useState<File[]>([]); // 저장할 때 붙일 도안 PDF
  const [saving, setSaving] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const existing = usePatterns(id ?? '-');
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
    if (!p.pattern.trim()) setP({ ...p, pattern: list[0].name.replace(/\.pdf$/i, '') });
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
        <h2 className="h2">기본 정보</h2>
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
          <h2 className="h2">도안 PDF</h2>
          <button type="button" className="btn dashed" onClick={() => pdfRef.current?.click()}>
            <Icon name="plus" size={18} />
            도안 PDF 불러오기
          </button>
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { addPdfs(e.target.files); e.target.value = ''; }} />
        </div>
        {!existing?.length && !pending.length && <p className="sub">파일 앱, iCloud Drive, 다운로드 폴더에서 도안 PDF를 골라두면 카운터 옆에 띄워놓고 뜰 수 있어요. 여러 개(본 도안, 사이즈표 등)를 넣어도 돼요.</p>}
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
