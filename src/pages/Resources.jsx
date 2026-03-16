import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  FolderOpen,
  Folder,
  Plus,
  ExternalLink,
  Trash2,
  X,
  Search,
  ChevronRight,
  ArrowLeft,
  FolderPlus,
  Globe,
  FileText,
  Video,
  BookOpen,
  Pencil,
  Check,
  GripVertical,
  CornerLeftUp,
  MoveRight,
} from 'lucide-react';
import { createPortal } from 'react-dom';

const DEFAULT_DATA = {
  folders: [
    { id: 'wgu', name: 'WGU Resources', parentId: null, icon: 'book' },
    { id: 'tools', name: 'Study Tools', parentId: null, icon: 'globe' },
    { id: 'general', name: 'General', parentId: null, icon: 'folder' },
  ],
  links: [],
};

const FOLDER_ICONS = {
  folder: Folder,
  book: BookOpen,
  globe: Globe,
  video: Video,
  file: FileText,
};

const FOLDER_COLORS = [
  'bg-accent/15 text-accent',
  'bg-emerald-500/15 text-emerald-400',
  'bg-purple-500/15 text-purple-400',
  'bg-amber-500/15 text-amber-400',
  'bg-pink-500/15 text-pink-400',
  'bg-cyan-500/15 text-cyan-400',
];

function getFolderColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return FOLDER_COLORS[Math.abs(hash) % FOLDER_COLORS.length];
}

function getLinkIcon(url) {
  if (!url) return Globe;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return Video;
  if (url.includes('docs.google') || url.includes('notion.') || url.includes('drive.google')) return FileText;
  return Globe;
}

export default function Resources() {
  const [data, setData] = useLocalStorage('studyhub-resources-v2', DEFAULT_DATA);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const searchRef = useRef(null);
  const renameRef = useRef(null);

  const { folders, links } = data;

  const currentFolders = folders.filter(f => f.parentId === currentFolderId);
  const currentLinks = links.filter(l => l.folderId === currentFolderId);
  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;

  const breadcrumbs = useMemo(() => {
    const trail = [];
    let fid = currentFolderId;
    while (fid) {
      const folder = folders.find(f => f.id === fid);
      if (!folder) break;
      trail.unshift(folder);
      fid = folder.parentId;
    }
    return trail;
  }, [currentFolderId, folders]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return {
      links: links.filter(l =>
        l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q)
      ),
      folders: folders.filter(f => f.name.toLowerCase().includes(q)),
    };
  }, [searchQuery, links, folders]);

  function getFolderPath(folderId) {
    const parts = [];
    let fid = folderId;
    while (fid) {
      const folder = folders.find(f => f.id === fid);
      if (!folder) break;
      parts.unshift(folder.name);
      fid = folder.parentId;
    }
    return parts.join(' / ') || 'Root';
  }

  function countItems(folderId) {
    let count = links.filter(l => l.folderId === folderId).length;
    const subFolders = folders.filter(f => f.parentId === folderId);
    count += subFolders.length;
    for (const sf of subFolders) count += countItems(sf.id);
    return count;
  }

  // CRUD
  function addFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setData(prev => ({
      ...prev,
      folders: [...prev.folders, { id: `folder-${Date.now()}`, name: newFolderName.trim(), parentId: currentFolderId }],
    }));
    setNewFolderName('');
    setShowAddFolder(false);
  }

  function deleteFolder(folderId) {
    const toDelete = new Set();
    function collect(id) {
      toDelete.add(id);
      folders.filter(f => f.parentId === id).forEach(f => collect(f.id));
    }
    collect(folderId);
    setData(prev => ({
      folders: prev.folders.filter(f => !toDelete.has(f.id)),
      links: prev.links.filter(l => !toDelete.has(l.folderId)),
    }));
    setDeleteConfirm(null);
  }

  function renameFolder(folderId) {
    if (!renameValue.trim()) return;
    setData(prev => ({
      ...prev,
      folders: prev.folders.map(f => f.id === folderId ? { ...f, name: renameValue.trim() } : f),
    }));
    setRenamingId(null);
    setRenameValue('');
  }

  function startRename(folder) {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
    setTimeout(() => renameRef.current?.focus(), 50);
  }

  function addLink(e) {
    e.preventDefault();
    if (!newLink.title.trim() || !newLink.url.trim()) return;
    let url = newLink.url.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setData(prev => ({
      ...prev,
      links: [...prev.links, { ...newLink, url, id: `link-${Date.now()}`, folderId: currentFolderId }],
    }));
    setNewLink({ title: '', url: '', description: '' });
    setShowAddLink(false);
  }

  function deleteLink(linkId) {
    setData(prev => ({ ...prev, links: prev.links.filter(l => l.id !== linkId) }));
    setDeleteConfirm(null);
  }

  const [nestTarget, setNestTarget] = useState(null);
  const nestTimerRef = useRef(null);
  const [movingFolderId, setMovingFolderId] = useState(null);

  // Check if targetId is a descendant of parentId (prevents circular nesting)
  function isDescendant(parentId, targetId) {
    let fid = targetId;
    while (fid) {
      if (fid === parentId) return true;
      const f = folders.find(fo => fo.id === fid);
      fid = f?.parentId;
    }
    return false;
  }

  function handleDragStart(e, folderId) {
    setDragId(folderId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, folderId) {
    e.preventDefault();
    if (!dragId || dragId === folderId) return;
    if (dragOverId !== folderId) {
      setDragOverId(folderId);
      setNestTarget(null);
      // Start nest timer - hold over a folder for 600ms to nest into it
      clearTimeout(nestTimerRef.current);
      nestTimerRef.current = setTimeout(() => {
        if (!isDescendant(dragId, folderId)) {
          setNestTarget(folderId);
        }
      }, 600);
    }
  }

  function handleDragLeave(folderId) {
    if (dragOverId === folderId) {
      setDragOverId(null);
      setNestTarget(null);
      clearTimeout(nestTimerRef.current);
    }
  }

  function handleDrop(e, folderId) {
    e.preventDefault();
    if (!dragId || dragId === folderId) return;

    if (nestTarget === folderId && !isDescendant(dragId, folderId)) {
      // Nest: move dragged folder inside the target folder
      setData(prev => ({
        ...prev,
        folders: prev.folders.map(f => f.id === dragId ? { ...f, parentId: folderId } : f),
      }));
    } else {
      // Reorder: swap positions among siblings
      setData(prev => {
        const newFolders = [...prev.folders];
        const dragIdx = newFolders.findIndex(f => f.id === dragId);
        const overIdx = newFolders.findIndex(f => f.id === folderId);
        if (dragIdx === -1 || overIdx === -1) return prev;
        const [moved] = newFolders.splice(dragIdx, 1);
        newFolders.splice(overIdx, 0, moved);
        return { ...prev, folders: newFolders };
      });
    }
    setDragId(null);
    setDragOverId(null);
    setNestTarget(null);
    clearTimeout(nestTimerRef.current);
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
    setNestTarget(null);
    clearTimeout(nestTimerRef.current);
  }

  // Move folder to root (unnest)
  function moveToRoot(folderId) {
    setData(prev => ({
      ...prev,
      folders: prev.folders.map(f => f.id === folderId ? { ...f, parentId: null } : f),
    }));
  }

  function moveFolder(folderId, newParentId) {
    setData(prev => ({
      ...prev,
      folders: prev.folders.map(f => f.id === folderId ? { ...f, parentId: newParentId } : f),
    }));
    setMovingFolderId(null);
  }

  function openFolder(folderId) {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  }

  function goBack() {
    if (currentFolder) {
      setCurrentFolderId(currentFolder.parentId ?? null);
    }
  }

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isSearching = searchResults !== null;
  const isEmpty = currentFolders.length === 0 && currentLinks.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            {currentFolderId && (
              <button onClick={goBack} className="p-1.5 -ml-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-2xl font-bold text-text-primary">
              {currentFolder ? currentFolder.name : 'Resources'}
            </h1>
          </div>
        </div>
        {breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
            <button onClick={() => setCurrentFolderId(null)} className="hover:text-accent transition-colors">Resources</button>
            {breadcrumbs.map(folder => (
              <span key={folder.id} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3" />
                <button
                  onClick={() => setCurrentFolderId(folder.id)}
                  className={folder.id === currentFolderId ? 'text-text-secondary' : 'hover:text-accent transition-colors'}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-9 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => { setShowAddFolder(true); setShowAddLink(false); }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors shrink-0"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Folder</span>
        </button>
        <button
          onClick={() => { setShowAddLink(true); setShowAddFolder(false); }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Link</span>
        </button>
      </div>

      {/* Add folder */}
      {showAddFolder && (
        <form onSubmit={addFolder} className="flex gap-2">
          <input
            type="text" placeholder="Folder name..." value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            className="flex-1 bg-bg-secondary border border-accent/50 rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button type="submit" disabled={!newFolderName.trim()} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">Create</button>
          <button type="button" onClick={() => setShowAddFolder(false)} className="p-2 text-text-muted hover:text-text-primary transition-colors"><X className="w-4 h-4" /></button>
        </form>
      )}

      {/* Add link */}
      {showAddLink && (
        <form onSubmit={addLink} className="bg-bg-secondary rounded-xl border border-accent/30 p-5 space-y-3">
          <p className="text-sm font-medium text-text-primary">Add a link</p>
          <input type="text" placeholder="Title" value={newLink.title} onChange={e => setNewLink(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          <input type="url" placeholder="https://..." value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          <input type="text" placeholder="Description (optional)" value={newLink.description} onChange={e => setNewLink(p => ({ ...p, description: e.target.value }))}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-[16px] sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => setShowAddLink(false)} className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">Cancel</button>
            <button type="submit" disabled={!newLink.title.trim() || !newLink.url.trim()} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">Add</button>
          </div>
        </form>
      )}

      {/* Search results */}
      {isSearching && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            {searchResults.folders.length + searchResults.links.length} result{searchResults.folders.length + searchResults.links.length !== 1 ? 's' : ''}
          </p>
          {searchResults.folders.length === 0 && searchResults.links.length === 0 && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-text-muted/30 mx-auto mb-3" />
              <p className="text-sm text-text-muted">No results found</p>
            </div>
          )}
          {searchResults.folders.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {searchResults.folders.map(folder => {
                const Icon = FOLDER_ICONS[folder.icon] || Folder;
                const colorClass = getFolderColor(folder.id);
                return (
                  <button key={folder.id} onClick={() => openFolder(folder.id)}
                    className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl border border-border hover:border-accent/40 transition-all text-left group">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}><Icon className="w-4 h-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{folder.name}</p>
                      <p className="text-[10px] text-text-muted">{getFolderPath(folder.parentId)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted/40 group-hover:text-accent transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {searchResults.links.length > 0 && (
            <div className="space-y-1">
              {searchResults.links.map(link => {
                const LinkIcon = getLinkIcon(link.url);
                return (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg-secondary transition-colors group">
                    <LinkIcon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary group-hover:text-accent transition-colors truncate">{link.title}</p>
                      <p className="text-[10px] text-text-muted truncate">{getFolderPath(link.folderId)}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-muted/40 group-hover:text-accent transition-colors shrink-0" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      {!isSearching && (
        <>
          {/* Folder cards */}
          {currentFolders.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentFolders.map(folder => {
                const Icon = FOLDER_ICONS[folder.icon] || Folder;
                const colorClass = getFolderColor(folder.id);
                const itemCount = countItems(folder.id);
                const isRenaming = renamingId === folder.id;
                const isDragOver = dragOverId === folder.id;

                const isNestTarget = nestTarget === folder.id;

                return (
                  <div
                    key={folder.id}
                    draggable
                    onDragStart={e => handleDragStart(e, folder.id)}
                    onDragOver={e => handleDragOver(e, folder.id)}
                    onDragLeave={() => handleDragLeave(folder.id)}
                    onDragEnd={handleDragEnd}
                    onDrop={e => handleDrop(e, folder.id)}
                    className={`group relative bg-bg-secondary rounded-xl border transition-all cursor-pointer ${
                      isNestTarget ? 'border-accent ring-2 ring-accent/30 bg-accent-muted scale-[1.02]' :
                      isDragOver ? 'border-accent/50 bg-accent-muted/50' : 'border-border hover:border-accent/40'
                    } ${dragId === folder.id ? 'opacity-50' : ''}`}
                    onClick={() => !isRenaming && openFolder(folder.id)}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-text-muted/0 group-hover:text-text-muted/50 cursor-grab transition-all shrink-0" />
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMovingFolderId(folder.id); }}
                            className="p-1.5 sm:p-1 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                            title="Move to..."
                          >
                            <MoveRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(folder); }}
                            className="p-1.5 sm:p-1 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                            title="Rename"
                          >
                            <Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(deleteConfirm === folder.id ? null : folder.id); }}
                            className="p-1.5 sm:p-1 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          </button>
                        </div>
                      </div>

                      {isRenaming ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); renameFolder(folder.id); }}
                          onClick={e => e.stopPropagation()}
                          className="flex gap-1.5"
                        >
                          <input
                            ref={renameRef}
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => renameFolder(folder.id)}
                            onKeyDown={e => { if (e.key === 'Escape') { setRenamingId(null); } }}
                            className="flex-1 bg-bg-primary border border-accent/50 rounded px-2 py-1 text-[16px] sm:text-sm text-text-primary focus:outline-none focus:border-accent min-w-0"
                          />
                          <button type="submit" className="p-1 text-accent"><Check className="w-3.5 h-3.5" /></button>
                        </form>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-text-primary mb-0.5">{folder.name}</p>
                          <p className="text-xs text-text-muted">
                            {isNestTarget ? 'Drop to nest inside' : `${itemCount} item${itemCount !== 1 ? 's' : ''}`}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Delete confirmation */}
                    {deleteConfirm === folder.id && (
                      <div
                        className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-2 z-10"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-xs text-text-secondary">Delete folder?</p>
                        <div className="flex gap-2">
                          <button onClick={() => deleteFolder(folder.id)} className="px-3 py-1 text-xs font-medium bg-danger text-white rounded-md hover:bg-danger/80 transition-colors">Delete</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 text-xs text-text-muted hover:text-text-primary transition-colors">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Links */}
          {currentLinks.length > 0 && (
            <div className="space-y-1">
              {currentFolders.length > 0 && (
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-2">Links</p>
              )}
              {currentLinks.map(link => {
                const LinkIcon = getLinkIcon(link.url);
                return (
                  <div key={link.id} className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg-secondary transition-colors">
                    <LinkIcon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                    <div className="min-w-0 flex-1">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-text-primary hover:text-accent transition-colors truncate block">
                        {link.title}
                      </a>
                      {link.description && <p className="text-xs text-text-muted mt-0.5 truncate">{link.description}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-text-muted hover:text-accent transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {deleteConfirm === link.id ? (
                        <button onClick={() => deleteLink(link.id)} className="px-2 py-0.5 text-[10px] font-medium bg-danger text-white rounded transition-colors">
                          Confirm
                        </button>
                      ) : (
                        <button onClick={() => setDeleteConfirm(link.id)} className="p-1.5 text-text-muted hover:text-danger transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {isEmpty && !showAddFolder && !showAddLink && (
            <div className="py-10 text-center">
              <FolderOpen className="w-10 h-10 text-text-muted/20 mx-auto mb-3" />
              <p className="text-sm text-text-muted mb-1">{currentFolderId ? 'This folder is empty' : 'No resources yet'}</p>
              <p className="text-xs text-text-muted/60">Add links, documents, and bookmarks to keep your study materials organized.</p>
            </div>
          )}
        </>
      )}

      {/* Move folder modal */}
      {movingFolderId && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={() => setMovingFolderId(null)}>
          <div className="bg-bg-secondary rounded-2xl border border-border p-5 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Move "{folders.find(f => f.id === movingFolderId)?.name}"
              </h3>
              <button onClick={() => setMovingFolderId(null)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {/* Move to root */}
              {folders.find(f => f.id === movingFolderId)?.parentId !== null && (
                <button
                  onClick={() => moveFolder(movingFolderId, null)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-hover transition-colors text-left"
                >
                  <CornerLeftUp className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-sm text-text-primary">Root (top level)</span>
                </button>
              )}
              {/* Available destination folders */}
              {folders
                .filter(f => f.id !== movingFolderId && !isDescendant(movingFolderId, f.id))
                .map(f => {
                  const Icon = FOLDER_ICONS[f.icon] || Folder;
                  const colorClass = getFolderColor(f.id);
                  const isCurrent = f.id === folders.find(fo => fo.id === movingFolderId)?.parentId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => moveFolder(movingFolderId, f.id)}
                      disabled={isCurrent}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                        isCurrent ? 'opacity-40 cursor-not-allowed' : 'hover:bg-bg-hover'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary truncate">{f.name}</p>
                        {f.parentId && (
                          <p className="text-[10px] text-text-muted truncate">{getFolderPath(f.parentId)}</p>
                        )}
                      </div>
                      {isCurrent && <span className="text-[10px] text-text-muted shrink-0">Current</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
