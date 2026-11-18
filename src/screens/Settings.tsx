import { useEffect, useRef, useState } from 'react';
import { getMeta, requestPersist } from '../lib/db';
import { makeBackup, markBackedUp, restoreBackup } from '../lib/backup';
import { shareFile } from '../lib/share';
import { dotDate } from '../lib/util';
import { Icon, TabBar } from '../components/ui';

export default function Settings() {
  const [last, setLast] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [status, setStatus] = useState('');
  const [upd, setUpd] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  useEffect(() => {
    getMeta<string>('lastBackup').then((v) => setLast(v ?? null));
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const checkUpdate = async () => {
    setUpd('새 버전을 확인하고 있어요…');
    const { hasUpdate, applyUpdate } = await import('../lib/update');
    const latest = await hasUpdate();
    if (latest) {
      setUpd(`새 버전(${latest})을 적용하고 있어요. 잠시 후 다시 열려요…`);
      await applyUpdate();
    } else setUpd(navigator.onLine ? '지금이 최신 버전이에요.' : '인터넷에 연결되어 있지 않아 확인하지 못했어요.');
  };

  const forceReload = async () => {
    if (!confirm('화면 파일을 새로 받아서 다시 열까요? 작품 기록, 사진, 도안은 그대로 있어요.')) return;
    const { applyUpdate } = await import('../lib/update');
    await applyUpdate();
  };

  const backup = async () => {
    setStatus('백업 파일을 만들고 있어요…');
    const { blob, filename } = await makeBackup();
    const r = await shareFile(blob, filename, '뜨개 다이어리 백업');
    if (r !== 'cancelled') {
      await markBackedUp();
      setLast(new Date().toISOString().slice(0, 10));
      setStatus(r === 'shared' ? '백업했어요. 파일 앱이나 iCloud Drive에 저장해두세요.' : '백업 파일을 내려받았어요.');
    } else setStatus('');
  };

  const restore = async (f?: File) => {
    if (!f) return;
    if (!confirm('백업 파일을 불러올까요? 같은 작품은 백업 내용으로 바뀌어요.')) return;
    try {
      const r = await restoreBackup(f);
      setStatus(`작품 ${r.projects}개, 사진 ${r.photos}장, 도안 ${r.patterns}개를 불러왔어요.`);
    } catch (e) {
      setStatus(`불러오지 못했어요: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <main className="page">
        <h1 className="big-title">백업 · 설정</h1>

        <section className="card stack">
          <h2 className="h2">백업</h2>
          <p>기록은 이 아이패드 안에만 저장돼요. 홈 화면 아이콘을 지우면 기록도 같이 지워지니, 가끔 백업 파일을 만들어 파일 앱이나 iCloud Drive에 보관하세요.</p>
          <p className="sub">마지막 백업: {last ? dotDate(last) : '아직 없음'}</p>
          <div className="grid2">
            <button type="button" className="btn primary" onClick={backup}>
              <Icon name="share" />
              백업 파일 만들기
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              백업 파일 불러오기
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          </div>
          {status && (
            <p className="notice ok" role="status">
              {status}
            </p>
          )}
        </section>

        <section className="card stack">
          <h2 className="h2">저장 상태</h2>
          <p>
            홈 화면 앱으로 실행 중: <b>{standalone ? '예' : '아니요'}</b>
          </p>
          {!standalone && <p className="notice warn">사파리 탭에서 열려 있어요. 공유 버튼 → '홈 화면에 추가'로 설치한 뒤 그 아이콘으로만 쓰세요. 사파리 탭과 홈 화면 앱은 저장 공간이 따로예요.</p>}
          <p>
            영구 저장 허용: <b>{persisted === null ? '확인 불가' : persisted ? '허용됨' : '아직 아님'}</b>
          </p>
          {!persisted && (
            <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => requestPersist().then(setPersisted)}>
              영구 저장 요청하기
            </button>
          )}
        </section>

        <section className="card stack">
          <h2 className="h2">앱 버전</h2>
          <p>
            지금 버전: <b>{__BUILD__}</b> 배포본
          </p>
          <div className="row wrap">
            <button type="button" className="btn" onClick={checkUpdate}>
              업데이트 확인
            </button>
            <button type="button" className="btn" onClick={forceReload}>
              강제로 새로 받기
            </button>
          </div>
          {upd && (
            <p className="notice ok" role="status">
              {upd}
            </p>
          )}
          <p className="sub" style={{ fontSize: 13 }}>
            앱을 완전히 닫았다가 다시 열어도 새 버전이 적용돼요.
          </p>
        </section>
      </main>
      <TabBar current="settings" />
    </>
  );
}
