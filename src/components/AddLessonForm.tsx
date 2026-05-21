'use client';

import { useState, useRef } from 'react';
import RichTextEditor from './RichTextEditor';
import { createLessonAction } from '@/app/actions';

export default function AddLessonForm({ courseId }: { courseId: number }) {
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    await createLessonAction(formData);
    
    // Clear the standard inputs
    formRef.current?.reset();
    
    // Force the TipTap component to entirely unmount and remount blank
    setResetKey(prev => prev + 1); 
    
    setIsSubmitting(false);
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
      <input type="hidden" name="courseId" value={courseId} />
      <div>
        <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Lesson Title</label>
        <input type="text" name="title" required placeholder="e.g. Introduction to logic" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Lesson Content</label>
        {/* The resetKey trick ensures the editor wipes completely clean after saving */}
        <RichTextEditor key={resetKey} name="content" />
      </div>
      <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold shadow-sm hover:bg-indigo-500 transition disabled:opacity-50">
        {isSubmitting ? 'Saving Lesson...' : 'Save Lesson Record'}
      </button>
    </form>
  );
}