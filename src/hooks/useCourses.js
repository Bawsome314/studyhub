import { useMemo } from 'react';
import { COURSES as DEFAULT_COURSES } from '../data/courses';
import { useLocalStorage } from './useLocalStorage';

export function useCourses() {
  const [customCourses, setCustomCourses] = useLocalStorage('studyhub-custom-courses', []);
  const [removedIds, setRemovedIds] = useLocalStorage('studyhub-removed-courses', []);

  const courses = useMemo(() => {
    const kept = DEFAULT_COURSES.filter(c => !removedIds.includes(c.id));
    return [...kept, ...customCourses];
  }, [customCourses, removedIds]);

  const totalCUs = useMemo(() => courses.reduce((sum, c) => sum + c.cus, 0), [courses]);

  function addCourse(course) {
    const id = course.code.toLowerCase().replace(/\s+/g, '');
    const newCourse = { ...course, id, cus: Number(course.cus) };
    setCustomCourses(prev => [...prev, newCourse]);
    return id;
  }

  function updateCourse(courseId, updates) {
    // If updating a custom course
    if (customCourses.some(c => c.id === courseId)) {
      setCustomCourses(prev =>
        prev.map(c => c.id === courseId ? { ...c, ...updates, cus: Number(updates.cus ?? c.cus) } : c)
      );
    } else {
      // It's a default course — "remove" original and add edited copy as custom
      const original = DEFAULT_COURSES.find(c => c.id === courseId);
      if (!original) return;
      setRemovedIds(prev => [...prev, courseId]);
      setCustomCourses(prev => [...prev, { ...original, ...updates, cus: Number(updates.cus ?? original.cus) }]);
    }
  }

  function removeCourse(courseId) {
    if (customCourses.some(c => c.id === courseId)) {
      setCustomCourses(prev => prev.filter(c => c.id !== courseId));
    } else {
      setRemovedIds(prev => [...prev, courseId]);
    }
  }

  function resetToDefaults() {
    setCustomCourses([]);
    setRemovedIds([]);
  }

  function isCustom(courseId) {
    return customCourses.some(c => c.id === courseId);
  }

  function isModifiedDefault(courseId) {
    // A default course that was edited (removed from defaults, re-added as custom with same id)
    return removedIds.includes(courseId) && customCourses.some(c => c.id === courseId);
  }

  return { courses, totalCUs, addCourse, updateCourse, removeCourse, resetToDefaults, isCustom, isModifiedDefault };
}
