import { useEffect, useState } from 'react';
import { applyUpdate, hasUpdate } from './lib/update';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { requestPersist } from './lib/db';
import { useRoute } from './lib/hooks';
import Archive from './screens/Archive';
import CalendarView from './screens/CalendarView';
import Counter from './screens/Counter';
import Export from './screens/Export';
import Home from './screens/Home';
import Photos from './screens/Photos';
import ProjectDetail from './screens/ProjectDetail';
import ProjectEdit from './screens/ProjectEdit';
import Settings from './screens/Settings';

function UpdateBanner() {
  const {
    needRefresh: [needRefresh]
  } = useRegisterSW();
  const [fresh, setFresh] = useState(false);
  // 앱을 열 때, 다른 앱에 갔다 돌아올 때, 30분마다 새 버전이 있는지 확인해요
  useEffect(() => {
    const check = () => document.visibilityState === 'visible' && hasUpdate().then((v) => setFresh(!!v));
    check();
    document.addEventListener('visibilitychange', check);
    const t = setInterval(check, 30 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(t);
    };
  }, []);
  if (!needRefresh && !fresh) return null;
  return (
    <div className="update-banner" role="status">
      새 버전이 있어요
      <button type="button" onClick={applyUpdate}>
        지금 적용
      </button>
    </div>
  );
}

function Screen() {
  const [name, id] = useRoute();
  switch (name) {
    case 'new':
      return <ProjectEdit />;
    case 'edit':
      return <ProjectEdit key={id} id={id} />;
    case 'project':
      return <ProjectDetail key={id} id={id} />;
    case 'counter':
      return <Counter key={id} id={id} />;
    case 'photos':
      return <Photos key={id} id={id} />;
    case 'export':
      return <Export key={id ?? 'none'} id={id} />;
    case 'archive':
      return <Archive />;
    case 'calendar':
      return <CalendarView />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

export default function App() {
  useEffect(() => {
    requestPersist();
  }, []);
  return (
    <>
      <Screen />
      <UpdateBanner />
    </>
  );
}
