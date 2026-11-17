import { useRef, useState } from 'react';
import { deletePhoto, savePhoto } from '../lib/db';
import { usePhotos, useProject } from '../lib/hooks';
import { shrinkImage } from '../lib/image';
import type { Photo } from '../lib/types';
import { shortDate, uid, ymd } from '../lib/util';
import { Icon, PhotoImg, Top } from '../components/ui';

function PhotoCard({ ph, pdfCount }: { ph: Photo; pdfCount: number }) {
  const [caption, setCaption] = useState(ph.caption);
  const togglePdf = () => {
    if (!ph.inPdf && pdfCount >= 3) {
      alert('PDF에는 사진을 3장까지 넣을 수 있어요. 다른 사진의 체크를 먼저 풀어주세요.');
      return;
    }
    savePhoto({ ...ph, inPdf: !ph.inPdf });
  };
  return (
    <figure className="photo">
      <PhotoImg photo={ph} w="100%" h="auto" alt={ph.caption || ph.tag} />
      <button type="button" className="pdf-toggle" aria-pressed={ph.inPdf} aria-label={ph.inPdf ? 'PDF에서 빼기' : 'PDF에 넣기'} onClick={togglePdf}>
        <Icon name="check" size={20} />
      </button>
      {ph.tag && <span className="ptag">{ph.tag}</span>}
      <figcaption className="row">
        <label style={{ flex: 1 }}>
          <span className="sr-only">사진 메모</span>
          <input style={{ width: '100%' }} value={caption} placeholder="메모 쓰기" onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== ph.caption && savePhoto({ ...ph, caption })} />
        </label>
        <button
          type="button"
          className="link-btn"
          aria-label="사진 삭제"
          style={{ color: 'var(--danger)' }}
          onClick={() => confirm('이 사진을 지울까요?') && deletePhoto(ph.id)}
        >
          <Icon name="trash" size={18} />
        </button>
      </figcaption>
    </figure>
  );
}

export default function Photos({ id }: { id: string }) {
  const p = useProject(id);
  const photos = usePhotos(id);
  const [mode, setMode] = useState<'date' | 'tag'>('date');
  const [busy, setBusy] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  if (!p || !photos) return null;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const blob = await shrinkImage(f);
        await savePhoto({ id: uid(), projectId: id, blob, createdAt: Date.now(), date: ymd(), tag: '', caption: '', inPdf: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const pdfCount = photos.filter((x) => x.inPdf).length;
  const groups = new Map<string, Photo[]>();
  for (const ph of photos) {
    const key = mode === 'date' ? ph.date : ph.tag.replace(/\s*\d+단$/, '').trim() || '태그 없음';
    groups.set(key, [...(groups.get(key) ?? []), ph]);
  }

  return (
    <main className="page no-tabs">
      <Top
        back={`#/project/${id}`}
        title="사진 기록"
        sub={`${p.name} · ${photos.length}장`}
        right={
          <div className="seg" role="radiogroup" aria-label="보기 방식" style={{ width: 200 }}>
            <button type="button" role="radio" aria-checked={mode === 'date'} onClick={() => setMode('date')}>
              날짜순
            </button>
            <button type="button" role="radio" aria-checked={mode === 'tag'} onClick={() => setMode('tag')}>
              파트별
            </button>
          </div>
        }
      />
      <div className="grid2">
        <button type="button" className="btn primary" style={{ minHeight: 60 }} disabled={busy} onClick={() => cam.current?.click()}>
          <Icon name="camera" />
          카메라로 찍기
        </button>
        <button type="button" className="btn" style={{ minHeight: 60 }} disabled={busy} onClick={() => album.current?.click()}>
          <Icon name="image" />
          앨범에서 고르기
        </button>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => add(e.target.files).finally(() => (e.target.value = ''))} />
        <input ref={album} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files).finally(() => (e.target.value = ''))} />
      </div>
      <p className="sub" style={{ fontSize: 13, marginTop: -12 }}>
        카운터 화면에서 찍으면 그때의 파트와 단수가 자동으로 붙어요. 체크한 사진({pdfCount}/3)은 PDF에 들어가요.
      </p>
      {busy && <p className="notice ok">사진을 저장하고 있어요…</p>}
      {photos.length === 0 && <div className="empty">아직 사진이 없어요. 실과 도안, 게이지 스와치부터 찍어두면 좋아요.</div>}
      {[...groups.entries()].map(([key, list]) => (
        <section key={key} className="stack">
          <h2 className="h3">{mode === 'date' ? `${shortDate(key)}${key === ymd() ? ' · 오늘' : ''}` : key}</h2>
          <div className="photo-grid">
            {list.map((ph) => (
              <PhotoCard key={ph.id} ph={ph} pdfCount={pdfCount} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
