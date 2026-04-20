import React, { useRef, useEffect } from 'react';
import { Bold, Italic, List, Link as LinkIcon, ListOrdered } from 'lucide-react';

export default function RichTextEditor({ value, onChange, placeholder, className }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const execCommand = (command, arg = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleLink = () => {
    const url = prompt('Enter URL (e.g. https://example.com):');
    if (url) execCommand('createLink', url);
  };

  return (
    <div className={`border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:border-emerald-600 transition-all group relative flex flex-col ${className}`}>
      <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-emerald-600 transition-all font-bold"
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-emerald-600 transition-all italic"
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-emerald-600 transition-all"
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={handleLink}
          className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-emerald-600 transition-all"
          title="Insert Link"
        >
          <LinkIcon size={16} />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="p-4 min-h-[120px] flex-1 overflow-y-auto focus:outline-none text-sm text-slate-600 bg-white list-inside"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
        spellCheck="false"
        data-placeholder={placeholder}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          font-style: italic;
        }
        [contenteditable] ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin: 0.5rem 0 !important;
        }
        [contenteditable] a {
          color: #065f46 !important;
          text-decoration: underline !important;
          font-weight: 600;
        }
      `}} />
    </div>
  );
}
