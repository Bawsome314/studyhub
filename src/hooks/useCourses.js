import { useMemo } from 'react';
import { COURSES as WGU_FINANCE_COURSES } from '../data/courses';
import { useLocalStorage } from './useLocalStorage';

export { WGU_FINANCE_COURSES };

export function useCourses() {
  const [courses, setCourses] = useLocalStorage('studyhub-courses', []);

  const totalCUs = useMemo(() => courses.reduce((sum, c) => sum + c.cus, 0), [courses]);

  function addCourse(course) {
    const id = course.code.toLowerCase().replace(/\s+/g, '');
    const newCourse = { ...course, id, cus: Number(course.cus) };
    setCourses(prev => [...prev, newCourse]);
    return id;
  }

  function updateCourse(courseId, updates) {
    setCourses(prev =>
      prev.map(c => c.id === courseId ? { ...c, ...updates, cus: Number(updates.cus ?? c.cus) } : c)
    );
  }

  function removeCourse(courseId) {
    setCourses(prev => prev.filter(c => c.id !== courseId));
  }

  function loadPreset(presetCourses) {
    // Merge: add courses that don't already exist by id
    setCourses(prev => {
      const existingIds = new Set(prev.map(c => c.id));
      const newCourses = presetCourses.filter(c => !existingIds.has(c.id));
      return [...prev, ...newCourses];
    });
  }

  function clearAll() {
    setCourses([]);
  }

  return { courses, totalCUs, addCourse, updateCourse, removeCourse, loadPreset, clearAll };
}
