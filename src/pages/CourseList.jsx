import { useCourses } from '../hooks/useCourses';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Link } from 'react-router-dom';
import { ChevronRight, BookOpen, ClipboardCheck } from 'lucide-react';

export default function CourseList() {
  const [courseProgress] = useLocalStorage('studyhub-course-progress', {});
  const { courses: COURSES } = useCourses();

  const statusLabel = {
    passed: 'Passed',
    'in-progress': 'In Progress',
    'not-started': 'Not Started',
  };
  const statusColor = {
    passed: 'text-success',
    'in-progress': 'text-warning',
    'not-started': 'text-text-muted',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Courses</h1>
      <div className="bg-bg-secondary rounded-xl border border-border divide-y divide-border overflow-hidden">
        {COURSES.map(course => {
          const status = courseProgress[course.id]?.status || 'not-started';
          const Icon = course.type === 'PA' ? ClipboardCheck : BookOpen;
          return (
            <Link
              key={course.id}
              to={`/course/${course.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors"
            >
              <Icon className="w-4 h-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  <span className="font-num font-semibold text-accent mr-2">{course.code}</span>
                  {course.name}
                </p>
              </div>
              <span className={`text-xs shrink-0 ${statusColor[status]}`}>
                {statusLabel[status]}
              </span>
              <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
