import { useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import ConfirmDialog from '../ConfirmDialog';
import { Link2, Plus, ExternalLink, Trash2, X, Tag } from 'lucide-react';

const CATEGORIES = ['General', 'WGU Material', 'Study Aid', 'Video', 'Practice', 'Reference', 'Other'];

export default function CourseLinks({ courseId }) {
  const [links, setLinks] = useLocalStorage(`studyhub-links-${courseId}`, []);
  const [showAdd, setShowAdd] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', category: 'General' });
  const [filter, setFilter] = useState('All');
  const [confirmAction, setConfirmAction] = useState(null);

  function addLink(e) {
    e.preventDefault();
    if (!newLink.title.trim() || !newLink.url.trim()) return;
    setLinks(prev => [...prev, { ...newLink, id: Date.now() }]);
    setNewLink({ title: '', url: '', category: 'General' });
    setShowAdd(false);
  }

  function deleteLink(id) {
    setLinks(prev => prev.filter(l => l.id !== id));
  }

  const usedCategories = ['All', ...new Set(links.map(l => l.category))];
  const filtered = filter === 'All' ? links : links.filter(l => l.category === filter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{links.length} link{links.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
        >
          {showAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showAdd ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addLink} className="bg-bg-tertiary rounded-lg border border-border p-3 space-y-2">
          <input
            type="text"
            placeholder="Link title"
            value={newLink.title}
            onChange={e => setNewLink(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            autoFocus
          />
          <input
            type="url"
            placeholder="https://..."
            value={newLink.url}
            onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <select
              value={newLink.category}
              onChange={e => setNewLink(p => ({ ...p, category: e.target.value }))}
              className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!newLink.title.trim() || !newLink.url.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors ml-auto"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Category filter */}
      {links.length > 0 && usedCategories.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {usedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                filter === cat
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Links list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <Link2 className="w-8 h-8 text-text-muted/50 mx-auto mb-2" />
          <p className="text-xs text-text-muted">
            {links.length === 0 ? 'No links added yet. Click "Add Link" to get started.' : 'No links in this category.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(link => (
            <div
              key={link.id}
              className="flex items-center gap-3 bg-bg-tertiary rounded-lg px-3 py-2.5 group hover:bg-bg-hover transition-colors"
            >
              <Link2 className="w-4 h-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-primary hover:text-accent transition-colors truncate block"
                >
                  {link.title}
                </a>
                <p className="text-[10px] text-text-muted truncate">{link.url}</p>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded shrink-0">
                <Tag className="w-2.5 h-2.5" />
                {link.category}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-accent transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setConfirmAction({ type: 'delete-link', id: link.id })}
                className="text-text-muted hover:text-danger transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title="Delete link?"
        message="This can't be undone."
        confirmLabel="Delete"
        confirmColor="bg-danger"
        onConfirm={() => { deleteLink(confirmAction.id); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
