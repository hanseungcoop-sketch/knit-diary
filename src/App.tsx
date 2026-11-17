import { useEffect } from 'react';
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
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    // 앱을 켜둔 동안에도 새 버전이 있는지 확인해요 (다시 앱으로 돌아올 때, 30분마다)
    onRegisteredSW(_url, r) {
      if (!r) return;
      const check = () => document.visibilityState === 'visible' && r.update().catch(() => {});
      document.addEventListener('visibilitychange', check);
      setInterval(check, 30 * 60 * 1000);
    }
  });
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      새 버전이 있어요
      <button type="button" onClick={() => updateServiceWorker(true)}>
        새로고침
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
