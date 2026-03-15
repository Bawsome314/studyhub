import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Detects the current course from the URL and returns toolbar tools
 * declared in the study guide index.
 *
 * Reads from `studyhub-guide-index` in localStorage which stores
 * `toolbarTools` (e.g. ["finance", "accounting", "graph"]) per course.
 *
 * @returns {{ courseTools: string[], courseId: string | null }}
 */
export function useCurrentCourseTools() {
  const location = useLocation();

  return useMemo(() => {
    try {
      // Match /course/:courseId (with optional trailing segments)
      const match = location.pathname.match(/^\/course\/([^/]+)/);
      if (!match) return { courseTools: [], courseId: null };

      const courseId = match[1];
      const raw = localStorage.getItem('studyhub-guide-index');
      if (!raw) return { courseTools: [], courseId };

      const index = JSON.parse(raw);
      const entry = index[courseId];
      const toolbarTools = Array.isArray(entry?.toolbarTools) ? entry.toolbarTools : [];

      return { courseTools: toolbarTools, courseId };
    } catch {
      return { courseTools: [], courseId: null };
    }
  }, [location.pathname]);
}
