import type { Gauge, Needle, Yarn } from './types';

/** 도안에서 찾은 정보. 찾지 못한 항목은 비어 있어요. */
export interface FoundInfo {
  pattern?: string;
  sizes: string[]; // 예: ['M', 'L', 'XL']
  chest: number[]; // 사이즈 순서대로 가슴둘레(cm)
  length: number[]; // 사이즈 순서대로 옷길이(cm)
  yarnName?: string;
  yarnWeight?: string; // 예: 6합
  yarnSpec?: string; // 예: 100g / 190m
  yarnGrams: number[]; // 사이즈 순서대로 사용량(g)
  yarnBalls: number[]; // 사이즈 순서대로 볼 수
  needles: Needle[];
  gauges: Gauge[];
}

const NUM = /\d+(?:\.\d+)?/g;
const nums = (s: string) => (s.match(NUM) ?? []).map(Number);
const SIZE_TOKEN = /^(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|FREE|프리|\d{2,3})$/i;
const round05 = (n: number) => Math.round(n * 2) / 2;

/** 한 줄에서 '항목 : 값'의 값 부분 */
const after = (line: string, label: RegExp) => {
  const m = line.match(label);
  if (!m || m.index === undefined) return null;
  return line.slice(m.index + m[0].length).replace(/^\s*[:：]\s*/, '').trim();
};
/** ※ 뒤의 안내문 같은 군더더기를 잘라요 */
const clean = (s: string) => s.split(/※|\*\s*완성|\(\*/)[0].trim();

function parseSizes(v: string) {
  return v
    .split(/\/|샘플/)[0]
    .split(/[\s,()（）]+/)
    .map((t) => t.trim())
    .filter((t) => SIZE_TOKEN.test(t));
}

function parseGauge(text: string): Gauge | null {
  // 한국어: 16코 25단 / 영어: 17 stitches and 22 rows
  let st: number | null = null;
  let row: number | null = null;
  const ko = text.match(/(\d+(?:\.\d+)?)\s*코\s*[x×*,]?\s*(\d+(?:\.\d+)?)\s*단/);
  const en = text.match(/(\d+(?:\.\d+)?)\s*(?:sts|stitches|st)\b[^\d]{0,20}?(\d+(?:\.\d+)?)\s*(?:rows|rnds|rounds|r)\b/i);
  if (ko) [st, row] = [Number(ko[1]), Number(ko[2])];
  else if (en) [st, row] = [Number(en[1]), Number(en[2])];
  else return null;
  // 10cm가 아닌 크기로 잰 게이지는 10cm 기준으로 바꿔요 (예: 7.5cm × 10cm)
  const dim = text.match(/(\d+(?:\.\d+)?)\s*(?:cm)?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*cm/i);
  if (dim) {
    const [w, h] = [Number(dim[1]), Number(dim[2])];
    if (w && w !== 10) st = round05((st * 10) / w);
    if (h && h !== 10) row = round05((row * 10) / h);
  }
  // 무늬 이름: 괄호 안에서 바늘·크기·숫자 설명을 뺀 나머지
  let pattern = '';
  const paren = text.match(/\(([^)]*)\)/);
  const src = paren ? paren[1] : text.replace(ko?.[0] ?? en?.[0] ?? '', '');
  pattern = src
    .replace(/\d+(?:\.\d+)?\s*mm\s*(바늘|needles?)?/gi, '')
    .replace(/\d+(?:\.\d+)?\s*cm\s*[x×*]\s*\d+(?:\.\d+)?\s*cm/gi, '')
    .replace(/\d+(?:\.\d+)?\s*[x×*]\s*\d+(?:\.\d+)?\s*cm/gi, '')
    .replace(/=\s*\d+\s*코/g, '')
    .replace(/겉\s*\d+|안\s*\d+|[+=]/g, ' ')
    .replace(/\b(in|on|=|with)\b/gi, ' ')
    .replace(/^[\s,.:]+|[\s,.:]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (/^\d+\.?$/.test(pattern)) pattern = '';
  return { pattern: pattern.slice(0, 24), patSt: st, patRow: row, mySt: null, myRow: null };
}

function parseNeedles(v: string): Needle[] {
  const sizes = [...new Set((v.match(/\d+(?:\.\d+)?\s*mm/gi) ?? []).map((s) => s.replace(/\s+/g, '').toLowerCase()))];
  const kind = (v.match(/조립식|줄바늘|대바늘|장갑바늘|막대바늘|circular|dpn|straight/i) ?? [''])[0];
  const cable = v.match(/(\d+)\s*cm\s*(케이블|cable)?/i);
  const kindText = [kind, cable && !/목둘레/.test(v.slice(0, cable.index ?? 0).slice(-6)) ? `${cable[1]}cm` : ''].filter(Boolean).join(' ');
  return sizes.map((size) => ({ size, kind: kindText, use: '' }));
}

/** 줄 단위 글자에서 도안 정보를 찾아요 */
export function parsePatternText(lines: string[]): FoundInfo {
  const f: FoundInfo = { sizes: [], chest: [], length: [], yarnGrams: [], yarnBalls: [], needles: [], gauges: [] };
  let inGauge = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    let v: string | null;

    // 게이지는 여러 줄에 걸쳐 나올 수 있어요 (1. 2. 3.)
    if ((v = after(line, /^(게이지|gauge|tension)/i)) !== null) {
      inGauge = true;
      const g = parseGauge(v);
      if (g) f.gauges.push(g);
      continue;
    }
    if (inGauge && /^\(?\d+[.)]/.test(line) && parseGauge(line)) {
      f.gauges.push(parseGauge(line)!);
      continue;
    }
    inGauge = false;

    if ((v = after(line, /^도안\s*(명|이름)?(?=\s*[:：])/)) !== null) f.pattern ??= clean(v);
    else if ((v = after(line, /^(사이즈|sizes?)(?=\s*[:：])/i)) !== null) f.sizes = parseSizes(v);
    else if ((v = after(line, /^(가슴\s*둘레|bust(\s*circumference)?|chest(\s*circumference)?)/i)) !== null) f.chest = nums(clean(v).split(/cm/i)[0]);
    else if ((v = after(line, /^(옷\s*길이|총\s*길이|length(\s*mid\s*back)?)/i)) !== null) f.length = nums(clean(v).split(/cm/i)[0]);
    else if ((v = after(line, /^(실\s*(사용량|소요량)|사용량|소요량)/)) !== null) {
      const parts = v.split('/');
      for (const part of parts) {
        if (/g\b|g\s*\(|g$/i.test(part) && /\d\s*g/i.test(part)) f.yarnGrams = (part.match(/\d+(?:\.\d+)?(?=\s*g)/gi) ?? []).map(Number);
        else if (/볼|타래|balls?|skeins?/i.test(part)) f.yarnBalls = nums(part);
      }
      if (!f.yarnGrams.length) f.yarnGrams = (v.match(/\d+(?:\.\d+)?(?=\s*g)/gi) ?? []).map(Number);
    } else if ((v = after(line, /^(사용\s*실|패키지\s*구성|실|yarn)(?=\s*[:：])/i)) !== null) {
      const spec = v.match(/\(([^)]*\d+\s*g[^)]*)\)/i);
      if (spec) f.yarnSpec = spec[1].replace(/\/\s*1\s*(볼|타래)\s*/g, '').replace(/\s*\/\s*/g, ' / ').replace(/\s*\/\s*$/, '');
      const w = v.match(/(\d+)\s*합/);
      if (w) f.yarnWeight = `${w[1]}합`;
      // 영어 도안: "Drops Air, 4 (4, 5, 5) balls of 50 g"
      const en = v.match(/^([^,]+),\s*([\d\s(),]+)\s*balls?\s*of\s*(\d+)\s*g/i);
      if (en) {
        f.yarnName = en[1].trim();
        f.yarnBalls = nums(en[2]);
        f.yarnSpec = `${en[3]}g`;
        f.yarnGrams = f.yarnBalls.map((b) => b * Number(en[3]));
        continue;
      }
      const balls = v.match(/\)\s*(\d+)\s*볼/);
      if (balls && !f.yarnBalls.length) f.yarnBalls = [Number(balls[1])];
      f.yarnName = v
        .replace(/\([^)]*\)/g, '')
        .replace(/\d+\s*합/, '')
        .replace(/\d+\s*볼/, '')
        .trim();
    } else if ((v = after(line, /^(사용\s*바늘|바늘|needles?)(?=\s*[:：])/i)) !== null) f.needles = parseNeedles(v);
  }
  return f;
}

/** 고른 사이즈 순서(없으면 첫 번째)의 값 */
export const bySize = (list: number[], sizes: string[], size: string) => {
  if (!list.length) return null;
  const i = sizes.findIndex((s) => s.toLowerCase() === size.trim().toLowerCase());
  return list[i >= 0 && i < list.length ? i : 0];
};

export const foundAnything = (f: FoundInfo) =>
  !!(f.pattern || f.sizes.length || f.chest.length || f.yarnName || f.yarnGrams.length || f.needles.length || f.gauges.length);

/** 찾은 실 정보를 실 기록 한 줄로 */
export function yarnFrom(f: FoundInfo, size: string): Yarn | null {
  if (!f.yarnName && !f.yarnGrams.length) return null;
  const g = bySize(f.yarnGrams, f.sizes, size);
  const b = bySize(f.yarnBalls, f.sizes, size);
  return {
    brand: '',
    name: [f.yarnName, f.yarnSpec && `(${f.yarnSpec})`].filter(Boolean).join(' '),
    color: '',
    lot: '',
    weight: f.yarnWeight ?? '',
    used: [g ? `${g}g` : '', b ? `${b}볼` : ''].filter(Boolean).join(' · '),
    remaining: ''
  };
}
