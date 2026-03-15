import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Eye, Edit3, Check } from 'lucide-react';

// Minimal markdown renderer - handles headers, bold, italic, code, links, lists, blockquotes, hr
function renderMarkdown(text) {
  if (!text) return '';

  const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = text.split('\n');
  const html = [];
  let inCodeBlock = false;
  let inList = false;
  let listType = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        html.push('</code></pre>');
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        html.push('<pre class="bg-bg-tertiary rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-text-primary"><code>');
      }
      continue;
    }
    if (inCodeBlock) {
      html.push(escapeHtml(line) + '\n');
      continue;
    }

    // Close list if we hit a non-list line
    if (inList && !line.match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
      html.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
      listType = null;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) {
      html.push('<hr class="border-border my-3" />');
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const sizes = { 1: 'text-xl font-bold', 2: 'text-lg font-semibold', 3: 'text-base font-semibold', 4: 'text-sm font-semibold', 5: 'text-sm font-medium', 6: 'text-xs font-medium' };
      html.push(`<h${level} class="${sizes[level]} text-text-primary mt-4 mb-2">${inlineMarkdown(escapeHtml(headerMatch[2]))}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      html.push(`<blockquote class="border-l-2 border-accent pl-3 my-2 text-text-secondary italic text-sm">${inlineMarkdown(escapeHtml(line.slice(2)))}</blockquote>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
        html.push('<ul class="list-disc list-inside my-1 space-y-0.5 text-sm">');
        inList = true;
        listType = 'ul';
      }
      html.push(`<li class="text-text-primary">${inlineMarkdown(escapeHtml(ulMatch[2]))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
        html.push('<ol class="list-decimal list-inside my-1 space-y-0.5 text-sm">');
        inList = true;
        listType = 'ol';
      }
      html.push(`<li class="text-text-primary">${inlineMarkdown(escapeHtml(olMatch[2]))}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      html.push('<div class="h-2"></div>');
      continue;
    }

    // Paragraph
    html.push(`<p class="text-sm text-text-primary leading-relaxed">${inlineMarkdown(escapeHtml(line))}</p>`);
  }

  if (inCodeBlock) html.push('</code></pre>');
  if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');

  return html.join('\n');
}

function inlineMarkdown(text) {
  return text
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs font-mono text-accent">$1</code>')
    // Bold + Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold"><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del class="line-through text-text-muted">$1</del>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">$1</a>');
}

export default function NotesEditor({ courseId }) {
  const [notes, setNotes] = useLocalStorage(`studyhub-notes-${courseId}`, '');
  const [mode, setMode] = useState('edit');
  const [saveStatus, setSaveStatus] = useState('');
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setNotes(value);

    setSaveStatus('saving...');
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 500);
  }, [setNotes]);

  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  // Auto-focus textarea on edit mode
  useEffect(() => {
    if (mode === 'edit' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mode]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-0.5">
          <button
            onClick={() => setMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'edit' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'preview' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              {saveStatus === 'saved' && <Check className="w-3 h-3 text-success" />}
              {saveStatus}
            </span>
          )}
          <span className="text-[10px] text-text-muted font-num">
            {notes.length} chars
          </span>
        </div>
      </div>

      {/* Editor / Preview */}
      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={handleChange}
          placeholder="Write your notes here... Supports **bold**, *italic*, `code`, # headers, - lists, > quotes, [links](url), and ```code blocks```"
          className="w-full min-h-[400px] bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-sm font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-y leading-relaxed"
          spellCheck
        />
      ) : (
        <div className="min-h-[400px] bg-bg-tertiary border border-border rounded-lg px-4 py-3">
          {notes ? (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(notes) }} />
          ) : (
            <p className="text-sm text-text-muted italic">Nothing here yet. Switch to Edit to start writing.</p>
          )}
        </div>
      )}

      <p className="text-[10px] text-text-muted">
        Markdown supported. Auto-saves as you type.
      </p>
    </div>
  );
}
