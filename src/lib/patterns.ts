import { savePattern } from './db';
import { prefs } from './hooks';
import type { PatternFile } from './types';
import { uid } from './util';

/** 도안 PDF를 작품에 붙여 저장해요 */
export async function addPatternFile(projectId: string, file: File) {
  const p: PatternFile = {
    id: uid(),
    projectId,
    name: file.name.replace(/\.pdf$/i, ''),
    blob: file,
    createdAt: Date.now(),
    page: 1,
    zoom: 1,
    ruler: null,
    follow: true
  };
  await savePattern(p);
  prefs.set('pattern:' + projectId, p.id);
  return p;
}
