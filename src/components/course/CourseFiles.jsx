import { useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import ConfirmDialog from '../ConfirmDialog';
import {
  FileText,
  Plus,
  ExternalLink,
  Trash2,
  X,
  File,
  FileSpreadsheet,
  FileImage,
  Presentation,
  FolderOpen,
} from 'lucide-react';

const FILE_TYPES = [
  { id: 'google-doc', label: 'Google Doc', icon: FileText, color: 'text-blue-400 bg-blue-400/15' },
  { id: 'google-sheet', label: 'Google Sheet', icon: FileSpreadsheet, color: 'text-green-400 bg-green-400/15' },
  { id: 'google-slides', label: 'Google Slides', icon: Presentation, color: 'text-yellow-400 bg-yellow-400/15' },
  { id: 'onedrive', label: 'OneDrive', icon: FolderOpen, color: 'text-sky-400 bg-sky-400/15' },
  { id: 'pdf', label: 'PDF', icon: File, color: 'text-red-400 bg-red-400/15' },
  { id: 'image', label: 'Image', icon: FileImage, color: 'text-purple-400 bg-purple-400/15' },
  { id: 'other', label: 'Other', icon: FileText, color: 'text-text-muted bg-bg-tertiary' },
];

function getFileType(typeId) {
  return FILE_TYPES.find(t => t.id === typeId) || FILE_TYPES[FILE_TYPES.length - 1];
}

// Auto-detect file type from URL
function detectFileType(url) {
  const lower = url.toLowerCase();
  if (lower.includes('docs.google.com/document')) return 'google-doc';
  if (lower.includes('docs.google.com/spreadsheets')) return 'google-sheet';
  if (lower.includes('docs.google.com/presentation')) return 'google-slides';
  if (lower.includes('onedrive') || lower.includes('sharepoint') || lower.includes('1drv.ms')) return 'onedrive';
  if (lower.endsWith('.pdf') || lower.includes('/pdf')) return 'pdf';
  if (lower.match(/\.(png|jpg|jpeg|gif|svg|webp)/)) return 'image';
  return 'other';
}

export default function CourseFiles({ courseId }) {
  const [files, setFiles] = useLocalStorage(`studyhub-files-${courseId}`, []);
  const [showAdd, setShowAdd] = useState(false);
  const [newFile, setNewFile] = useState({ title: '', url: '', type: 'other' });
  const [confirmAction, setConfirmAction] = useState(null);

  function addFile(e) {
    e.preventDefault();
    if (!newFile.title.trim() || !newFile.url.trim()) return;
    setFiles(prev => [...prev, { ...newFile, id: Date.now() }]);
    setNewFile({ title: '', url: '', type: 'other' });
    setShowAdd(false);
  }

  function deleteFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  function handleUrlChange(url) {
    const detected = detectFileType(url);
    setNewFile(p => ({ ...p, url, type: detected }));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{files.length} file{files.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
        >
          {showAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showAdd ? 'Cancel' : 'Add File'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addFile} className="bg-bg-tertiary rounded-lg border border-border p-3 space-y-2">
          <input
            type="text"
            placeholder="File name"
            value={newFile.title}
            onChange={e => setNewFile(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            autoFocus
          />
          <input
            type="url"
            placeholder="https://docs.google.com/... or OneDrive link"
            value={newFile.url}
            onChange={e => handleUrlChange(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <select
              value={newFile.type}
              onChange={e => setNewFile(p => ({ ...p, type: e.target.value }))}
              className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {FILE_TYPES.map(ft => (
                <option key={ft.id} value={ft.id}>{ft.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newFile.title.trim() || !newFile.url.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors ml-auto"
            >
              Add
            </button>
          </div>
          <p className="text-[10px] text-text-muted">File type auto-detects from URL. Files open in a new tab.</p>
        </form>
      )}

      {/* Files list */}
      {files.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-text-muted/50 mx-auto mb-2" />
          <p className="text-xs text-text-muted">
            No files added yet. Link Google Docs, OneDrive files, PDFs, etc.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {files.map(file => {
            const ft = getFileType(file.type);
            const Icon = ft.icon;
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 bg-bg-tertiary rounded-lg px-3 py-3 group hover:bg-bg-hover transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ft.color}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-primary hover:text-accent transition-colors truncate block font-medium"
                  >
                    {file.title}
                  </a>
                  <p className="text-[10px] text-text-muted">{ft.label}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-text-muted hover:text-accent transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setConfirmAction({ type: 'delete-file', id: file.id })}
                    className="p-1 text-text-muted hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title="Delete file?"
        message="This can't be undone."
        confirmLabel="Delete"
        confirmColor="bg-danger"
        onConfirm={() => { deleteFile(confirmAction.id); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
