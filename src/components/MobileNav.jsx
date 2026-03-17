import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Target,
  FolderOpen,
  Settings,
} from 'lucide-react';

const TABS = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/term-plan', icon: CalendarDays, label: 'Plan' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/resources', icon: FolderOpen, label: 'Resources' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border z-50 lg:hidden safe-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[10px] transition-all duration-200 btn-press ${
                isActive
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`
            }
          >
            <Icon className={`w-5 h-5 transition-transform duration-200`} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
