'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { useState } from 'react';
import { Bold, Italic, Image as ImageIcon, Video as YoutubeIcon, Heading } from 'lucide-react';

export default function RichTextEditor({ name }: { name: string }) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Youtube.configure({
        controls: true,
        nocookie: true,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg mx-auto focus:outline-none min-h-[150px] p-4',
      },
    },
  });

  if (!editor) return null;

  const addImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=b2492f987920d3e2a7903861b72ae3a4`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          editor.chain().focus().setImage({ src: data.data.url }).run();
        }
      } catch (error) {
        console.error('Upload failed', error);
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  };

  const addYoutube = () => {
    const url = prompt('Enter YouTube URL');
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-2 flex-wrap">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('heading') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}><Heading size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('bold') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}><Bold size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('italic') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}><Italic size={16} /></button>
        <div className="w-px h-6 bg-slate-300 mx-1 self-center"></div>
        <button type="button" onClick={addImage} disabled={isUploading} className="p-2 rounded hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1 text-slate-600">
          <ImageIcon size={16} /> {isUploading && <span className="text-xs">Uploading...</span>}
        </button>
        <button type="button" onClick={addYoutube} className="p-2 rounded hover:bg-slate-200 text-slate-600"><YoutubeIcon size={16} /></button>
      </div>
      <EditorContent editor={editor} className="cursor-text" />
      <input type="hidden" name={name} value={content} />
    </div>
  );
}