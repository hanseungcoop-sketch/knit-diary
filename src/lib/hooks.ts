import { useEffect, useState } from 'react';
import { getProject, listPhotos, listProjects, onChange } from './db';
import type { Photo, Project } from './types';

/** 저장소가 바뀔 때마다 다시 읽어오는 작은 훅 */
function useLive<T>(load: () => Promise<T>, deps: unknown[]): T | undefined {
  const [v, setV] = useState<T>();
  useEffect(() => {
    let alive = true;
    const run = () => load().then((x) => alive && setV(x));
    run();
    const off = onChange(run);
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

export const useProjects = () => useLive<Project[]>(listProjects, []);
export const useProject = (id: string) => useLive<Project | undefined>(() => getProject(id), [id]);
export const usePhotos = (id: string) => useLive<Photo[]>(() => listPhotos(id), [id]);

/** 사진 Blob을 화면에 보여줄 주소로 바꿔요 */
export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** #/project/abc 같은 주소로 화면을 바꿔요 (GitHub Pages에서도 새로고침해도 안전) */
export function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const f = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parts;
}

export const go = (path: string) => {
  location.hash = '/' + path.replace(/^\//, '');
};
