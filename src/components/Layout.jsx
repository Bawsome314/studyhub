import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import FloatingToolbar from './FloatingToolbar';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <main className="lg:ml-[260px] min-h-screen pb-20 lg:pb-0">
        <div key={location.pathname} className="max-w-[1150px] mx-auto px-4 sm:px-6 lg:px-8 py-6 page-enter">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <FloatingToolbar />
    </div>
  );
}
