import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import { migrateGuidesToIndexedDB } from './lib/migrateGuides';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TermPlan from './pages/TermPlan';
import Course from './pages/Course';
import CourseList from './pages/CourseList';
import Resources from './pages/Resources';
import Settings from './pages/Settings';
import Goals from './pages/Goals';

export default function App() {
  // Fire-and-forget migration from localStorage to IndexedDB
  useEffect(() => {
    migrateGuidesToIndexedDB();
  }, []);

  return (
    <ThemeProvider>
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
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
