import type { ReactNode } from 'react';
import { useBlobUrl } from '../lib/hooks';
import type { Photo } from '../lib/types';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const icons = {
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  pdf: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 14h6M10 17h4" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M20 16l-5-5-8 8" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  share: <path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" />,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
  yarn: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M5 9c4 1 10 1 14 0M4.5 13c5 1.5 10 1.5 15 0M8 5.5c2 4 2 9 0 13M14 4.5c-2 5-2 10 0 15" />
    </>
  )
};

export function Icon({ name, size = 22, label }: { name: keyof typeof icons; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...P} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {icons[name]}
    </svg>
  );
}

export function TabBar({ current }: { current: 'home' | 'archive' | 'calendar' | 'export' | 'settings' }) {
  const tabs = [
    ['home', '홈', 'home', '#/'],
    ['archive', '보관함', 'grid', '#/archive'],
    ['calendar', '캘린더', 'calendar', '#/calendar'],
    ['export', 'PDF', 'pdf', '#/export'],
    ['settings', '백업·설정', 'gear', '#/settings']
  ] as const;
  return (
    <nav className="tabs" aria-label="주 메뉴">
      {tabs.map(([id, label, icon, href]) => (
        <a key={id} href={href} aria-current={current === id ? 'page' : undefined}>
          <Icon name={icon} size={26} />
          {label}
        </a>
      ))}
    </nav>
  );
}

export function Top({ back, title, sub, right }: { back?: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="top">
      {back && (
        <a className="icon-btn" href={back} aria-label="뒤로">
          <Icon name="back" />
        </a>
      )}
      <div className="titles">
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export const Bar = ({ pct }: { pct: number }) => (
  <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
    <span style={{ width: `${pct}%` }} />
  </div>
);

export function PhotoImg({ photo, w, h, alt = '' }: { photo?: Photo; w: number | string; h: number | string; alt?: string }) {
  const url = useBlobUrl(photo?.blob);
  const style = { width: w, height: h, flexShrink: 0 };
  if (!photo || !url)
    return (
      <div className="thumb placeholder" style={style} aria-hidden="true">
        <Icon name="yarn" size={44} />
      </div>
    );
  return <img className="thumb" src={url} alt={alt} style={style} />;
}
