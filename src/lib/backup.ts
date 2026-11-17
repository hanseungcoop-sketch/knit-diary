import { listAllPatterns, listAllPhotos, listProjects, savePattern, saveProject, savePhoto, setMeta } from './db';
import { blobToDataUrl, dataUrlToBlob } from './image';
import type { PatternFile, Photo, Project } from './types';
import { ymd } from './util';

interface BackupFile {
  app: 'knit-diary';
  version: 1;
  exportedAt: string;
  projects: Project[];
  photos: (Omit<Photo, 'blob'> & { data: string })[];
  patterns?: (Omit<PatternFile, 'blob'> & { data: string })[];
}

export async function makeBackup(): Promise<{ blob: Blob; filename: string }> {
  const projects = await listProjects();
  const photos = await listAllPhotos();
  const patterns = await listAllPatterns();
  const file: BackupFile = {
    app: 'knit-diary',
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    photos: await Promise.all(photos.map(async ({ blob, ...rest }) => ({ ...rest, data: await blobToDataUrl(blob) }))),
    patterns: await Promise.all(patterns.map(async ({ blob, ...rest }) => ({ ...rest, data: await blobToDataUrl(blob) })))
  };
  return {
    blob: new Blob([JSON.stringify(file)], { type: 'application/json' }),
    filename: `뜨개다이어리-백업-${ymd().replace(/-/g, '')}.json`
  };
}

export const markBackedUp = () => setMeta('lastBackup', ymd());

/** 백업 파일을 불러와요. 같은 작품·사진은 백업 내용으로 덮어쓰고, 나머지는 그대로 둬요. */
export async function restoreBackup(file: File) {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'knit-diary' || !Array.isArray(data.projects)) throw new Error('뜨개 다이어리 백업 파일이 아니에요.');
  for (const p of data.projects) await saveProject(p);
  for (const { data: url, ...rest } of data.photos ?? []) await savePhoto({ ...rest, blob: await dataUrlToBlob(url) });
  for (const { data: url, ...rest } of data.patterns ?? []) await savePattern({ ...rest, blob: await dataUrlToBlob(url) });
  return { projects: data.projects.length, photos: data.photos?.length ?? 0, patterns: data.patterns?.length ?? 0 };
}
