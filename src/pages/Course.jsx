import { useParams, Navigate } from 'react-router-dom';
import { useCourses } from '../hooks/useCourses';
import { BookOpen, ClipboardCheck, StickyNote, Link2, FileText } from 'lucide-react';
import { useState } from 'react';
import StudyGuideHub from '../components/study/StudyGuideHub';
import NotesEditor from '../components/course/NotesEditor';
import CourseLinks from '../components/course/CourseLinks';
import CourseFiles from '../components/course/CourseFiles';
import TaskChecklist from '../components/course/TaskChecklist';

const TABS_OA = [
  { id: 'study-guide', icon: BookOpen, label: 'Study Guide' },
  { id: 'notes', icon: StickyNote, label: 'Notes' },
  { id: 'links', icon: Link2, label: 'Links' },
  { id: 'files', icon: FileText, label: 'Files' },
];

const TABS_PA = [
  { id: 'tasks', icon: ClipboardCheck, label: 'Tasks' },
  { id: 'notes', icon: StickyNote, label: 'Notes' },
  { id: 'links', icon: Link2, label: 'Links' },
  { id: 'files', icon: FileText, label: 'Files' },
];

const TABS_CAPSTONE = [
  { id: 'study-guide', icon: BookOpen, label: 'Study Guide' },
  { id: 'tasks', icon: ClipboardCheck, label: 'Tasks' },
  { id: 'notes', icon: StickyNote, label: 'Notes' },
  { id: 'links', icon: Link2, label: 'Links' },
  { id: 'files', icon: FileText, label: 'Files' },
];

export default function Course() {
  const { courseId } = useParams();
  const { courses } = useCourses();
  const course = courses.find(c => c.id === courseId);
  const isCapstone = course?.category === 'Capstone' || course?.type === 'Capstone';
  const [activeTab, setActiveTab] = useState(
    isCapstone ? 'study-guide' : course?.type === 'PA' ? 'tasks' : 'study-guide'
  );

  if (!course) return <Navigate to="/" replace />;

  const tabs = isCapstone ? TABS_CAPSTONE : course.type === 'PA' ? TABS_PA : TABS_OA;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold font-num text-accent">{course.code}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">{course.type}</span>
          <span className="text-xs font-num text-text-muted">{course.cus} CU</span>
        </div>
        <h1 className="text-xl font-bold text-text-primary">{course.name}</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-bg-secondary rounded-lg p-1 border border-border overflow-x-auto card-shadow">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 btn-press ${
              activeTab === id
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-bg-secondary rounded-xl border border-border p-6 min-h-[300px] card-shadow">
        {activeTab === 'study-guide' && (
          <StudyGuideHub
            courseId={course.id}
            courseCode={course.code}
            courseName={course.name}
          />
        )}
        {activeTab === 'tasks' && <TaskChecklist courseId={course.id} />}
        {activeTab === 'notes' && <NotesEditor courseId={course.id} />}
        {activeTab === 'links' && <CourseLinks courseId={course.id} />}
        {activeTab === 'files' && <CourseFiles courseId={course.id} />}
      </div>
    </div>
  );
}
