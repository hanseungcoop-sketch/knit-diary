export interface Yarn {
  brand: string;
  name: string;
  color: string;
  lot: string;
  weight: string; // 굵기·합 (예: 6합)
  used: string; // 사용량 (예: 422g)
  remaining: string; // 남은 양
}

export interface Needle {
  size: string; // 예: 5mm
  kind: string; // 예: 조립식 80cm
  use: string; // 예: 몸판
}

export interface Gauge {
  pattern: string; // 무늬 이름
  patSt: number | null; // 도안 코 (10cm)
  patRow: number | null; // 도안 단
  mySt: number | null; // 내 코
  myRow: number | null; // 내 단
}

export interface Part {
  id: string;
  name: string;
  target: number; // 목표 단수 (0 = 정하지 않음)
  count: number; // 완성한 단수
  repeatLen: number; // 무늬 반복 단수 (0 = 사용 안 함)
  repeat: number; // 반복 안에서 지금 몇 번째 단 (1부터)
  decStart: number; // 알림 시작 단 (0 = 알림 없음)
  decEvery: number; // 몇 단마다
  decTimes: number; // 몇 번
  decText: string; // 알림 문구 (예: 양쪽 1코 줄임)
  doneDate: string | null;
}

export interface LogEntry {
  date: string; // YYYY-MM-DD
  partId: string;
  rows: number;
}

export interface Project {
  id: string;
  name: string;
  pattern: string; // 도안 이름
  source: string; // 도안 출처
  size: string;
  chestCm: number | null; // 도안 기준 가슴둘레 (게이지 차이 계산용)
  audience: string; // 사용 대상
  difficulty: number; // 0~5
  startDate: string;
  endDate: string | null;
  status: 'active' | 'done';
  memo: string; // 수정한 부분과 이유
  yarns: Yarn[];
  needles: Needle[];
  gauges: Gauge[];
  parts: Part[];
  log: LogEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface Photo {
  id: string;
  projectId: string;
  blob: Blob;
  createdAt: number;
  date: string; // YYYY-MM-DD
  tag: string; // 예: 몸판 84단
  caption: string;
  inPdf: boolean;
}

export const emptyYarn = (): Yarn => ({ brand: '', name: '', color: '', lot: '', weight: '', used: '', remaining: '' });
export const emptyNeedle = (): Needle => ({ size: '', kind: '', use: '' });
export const emptyGauge = (): Gauge => ({ pattern: '', patSt: null, patRow: null, mySt: null, myRow: null });
