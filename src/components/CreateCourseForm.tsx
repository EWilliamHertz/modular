'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateCourseForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
      if (data.success) setImageUrl(data.data.url);
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    formData.append('image_url', imageUrl);
    await action(formData);
    toast.success('Course created successfully!');
    formRef.current?.reset();
    setImageUrl('');
    setIsSubmitting(false);
  };

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Course Title</label>
          <input type="text" name="title" required placeholder="e.g. Next.js Masterclass" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition bg-white" />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Short Description</label>
          <input type="text" name="description" required placeholder="What will students learn?" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition bg-white" />
        </div>
        <div className="w-full sm:w-32">
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Price ($)</label>
          <input type="number" name="price" step="0.01" min="0" required placeholder="29.00" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition bg-white" />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-slate-200 mt-2">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-100 transition cursor-pointer shadow-sm">
            {isUploading ? 'Uploading...' : <><ImageIcon size={16} /> Add Cover Image</>}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
          </label>
          {imageUrl && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14} /> Uploaded</span>}
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-indigo-600 text-white rounded-xl px-8 py-2.5 text-sm font-bold shadow-md hover:bg-indigo-500 transition disabled:opacity-50">
          {isSubmitting ? 'Creating...' : 'Create Course'}
        </button>
      </div>
    </form>
  );
}