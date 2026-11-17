import type { Project } from './types';
import { parseYmd, ymd } from './util';

const icsDate = (s: string) => s.replace(/-/g, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** 작품 기간을 하루 종일 일정 하나로 만든 .ics 파일. 열면 아이패드 캘린더에 추가할 수 있어요. */
export function projectIcs(p: Project): Blob {
  const end = p.endDate ?? ymd();
  const endNext = parseYmd(end);
  endNext.setDate(endNext.getDate() + 1); // 종일 일정의 끝 날짜는 다음 날로 적어요
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const desc = [p.pattern && `도안: ${p.pattern}`, p.source && `출처: ${p.source}`, p.yarns[0] && `실: ${[p.yarns[0].brand, p.yarns[0].name].filter(Boolean).join(' ')}`]
    .filter(Boolean)
    .join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//knit-diary//KO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${p.id}@knit-diary`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(p.startDate)}`,
    `DTEND;VALUE=DATE:${icsDate(ymd(endNext))}`,
    `SUMMARY:${esc('[뜨개] ' + (p.name || '작품'))}`,
    `DESCRIPTION:${esc(desc)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}
