import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PatternFile, Photo, Project } from './types';

interface KnitDB extends DBSchema {
  projects: { key: string; value: Project };
  photos: { key: string; value: Photo; indexes: { byProject: string } };
  meta: { key: string; value: unknown };
  patterns: { key: string; value: PatternFile; indexes: { byProject: string } };
}

let dbp: Promise<IDBPDatabase<KnitDB>> | null = null;
const db = () => {
  if (!dbp) {
    dbp = openDB<KnitDB>('knit-diary', 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore('projects', { keyPath: 'id' });
          const ph = d.createObjectStore('photos', { keyPath: 'id' });
          ph.createIndex('byProject', 'projectId');
          d.createObjectStore('meta');
        }
        if (oldVersion < 2) {
          // 버전 2: 도안 PDF 저장소 추가 (기존 기록은 그대로 유지)
          const pt = d.createObjectStore('patterns', { keyPath: 'id' });
          pt.createIndex('byProject', 'projectId');
        }
      }
    });
  }
  return dbp;
};

// 화면들이 데이터 변경을 알 수 있게 하는 아주 작은 이벤트
const listeners = new Set<() => void>();
export const onChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((f) => f());

export const listProjects = async () => {
  const all = await (await db()).getAll('projects');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
};
export const getProject = async (id: string) => (await db()).get('projects', id);
export const saveProject = async (p: Project) => {
  p.updatedAt = Date.now();
  await (await db()).put('projects', p);
  emit();
};
export const deleteProject = async (id: string) => {
  const d = await db();
  const tx = d.transaction(['projects', 'photos', 'patterns'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  const keys = await tx.objectStore('photos').index('byProject').getAllKeys(id);
  for (const k of keys) await tx.objectStore('photos').delete(k);
  const pkeys = await tx.objectStore('patterns').index('byProject').getAllKeys(id);
  for (const k of pkeys) await tx.objectStore('patterns').delete(k);
  await tx.done;
  emit();
};

export const listPhotos = async (projectId: string) => {
  const all = await (await db()).getAllFromIndex('photos', 'byProject', projectId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
};
export const listAllPhotos = async () => (await db()).getAll('photos');
export const savePhoto = async (p: Photo) => {
  await (await db()).put('photos', p);
  emit();
};
export const deletePhoto = async (id: string) => {
  await (await db()).delete('photos', id);
  emit();
};

export const listPatterns = async (projectId: string) => {
  const all = await (await db()).getAllFromIndex('patterns', 'byProject', projectId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
};
export const listAllPatterns = async () => (await db()).getAll('patterns');
/** quiet: 쪽·자 위치처럼 자주 바뀌는 값은 다른 화면을 다시 그리지 않고 저장만 해요 */
export const savePattern = async (p: PatternFile, quiet = false) => {
  await (await db()).put('patterns', p);
  if (!quiet) emit();
};
export const deletePattern = async (id: string) => {
  await (await db()).delete('patterns', id);
  emit();
};

export const getMeta = async <T>(key: string) => (await (await db()).get('meta', key)) as T | undefined;
export const setMeta = async (key: string, value: unknown) => {
  await (await db()).put('meta', value, key);
  emit();
};

/** 브라우저에 이 앱의 데이터를 지우지 말라고 요청 */
export const requestPersist = async () => {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* 지원하지 않는 브라우저 */
  }
  return false;
};
