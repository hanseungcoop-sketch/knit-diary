// 새 버전 확인과 적용.
// 아이패드 홈 화면 앱은 서비스 워커만으로는 새 버전을 늦게 알아채는 경우가 있어서,
// 배포할 때마다 만들어지는 version.json을 직접 확인하고, 필요하면 저장된 화면 파일(캐시)을 비우고 다시 열어요.
// 작품 기록·사진·도안은 캐시가 아닌 IndexedDB에 있어서 지워지지 않아요.

export const CURRENT = __BUILD__;

/** 배포된 최신 버전 (확인 못 하면 null) */
export async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { build: string }).build ?? null;
  } catch {
    return null;
  }
}

export async function hasUpdate() {
  const latest = await latestBuild();
  return latest !== null && latest !== CURRENT ? latest : null;
}

/** 새 버전 적용: 서비스 워커를 새로 받고, 안 되면 캐시를 비우고 다시 열어요 */
export async function applyUpdate() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    for (const r of regs) await r.unregister();
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* 그래도 다시 열기는 해요 */
  }
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString());
  location.replace(url.toString());
}
