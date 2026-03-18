import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { migrateGuidesToIndexedDB } from './lib/migrateGuides';
import { cleanOrphanedGuides } from './lib/indexedDB';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TermPlan from './pages/TermPlan';
import Course from './pages/Course';
import CourseList from './pages/CourseList';
import Resources from './pages/Resources';
import Settings from './pages/Settings';
import Goals from './pages/Goals';

export default function App() {
  const [updateAvailable, setUpdateAvailable] = useState(null);

  // Fire-and-forget migration + cleanup
  useEffect(() => {
    migrateGuidesToIndexedDB().then(() => cleanOrphanedGuides());
  }, []);

  // Listen for service worker updates
  useEffect(() => {
    function onUpdate(e) {
      setUpdateAvailable(e.detail);
    }
    window.addEventListener('sw-update-available', onUpdate);
    return () => window.removeEventListener('sw-update-available', onUpdate);
  }, []);

  function applyUpdate() {
    if (updateAvailable) {
      updateAvailable.postMessage('skipWaiting');
    }
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SyncProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/courses" element={<CourseList />} />
                  <Route path="/course/:courseId" element={<Course />} />
                  <Route path="/term-plan" element={<TermPlan />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Routes>
            </BrowserRouter>

            {/* Update toast */}
            {updateAvailable && (
              <button
                onClick={applyUpdate}
                className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[998] flex items-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl shadow-lg shadow-accent/25 hover:bg-accent-hover transition-colors animate-[slideUp_300ms_ease-out]"
              >
                Update available — tap to refresh
              </button>
            )}
          </SyncProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
