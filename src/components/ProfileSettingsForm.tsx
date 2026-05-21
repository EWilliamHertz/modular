'use client';

import { useState, useRef } from 'react';
import { Trash2, Plus, Upload, FileText, CheckCircle2 } from 'lucide-react';

export default function ProfileSettingsForm({ userProfile, action }: { userProfile: any, action: (formData: FormData) => Promise<void> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResume, setShowResume] = useState(userProfile.show_resume ?? true);
  const [showPortfolio, setShowPortfolio] = useState(userProfile.show_portfolio ?? true);
  
  const [resumeData, setResumeData] = useState(userProfile.resume_pdf_data || '');
  const [pdfName, setPdfName] = useState(userProfile.resume_pdf_data ? 'Existing PDF Resume' : '');
  
  const initialItems = typeof userProfile.portfolio_items === 'string' 
    ? JSON.parse(userProfile.portfolio_items) 
    : (userProfile.portfolio_items || []);
  const [portfolioItems, setPortfolioItems] = useState<any[]>(initialItems);

  // New Item State
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check size to prevent overwhelming the server payload (limit to ~2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("Please keep PDF size under 2MB for optimal performance.");
      return;
    }

    setPdfName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setResumeData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=b2492f987920d3e2a7903861b72ae3a4`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) setNewItemImage(data.data.url);
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const addPortfolioItem = () => {
    if (!newItemTitle) return;
    setPortfolioItems([...portfolioItems, {
      title: newItemTitle,
      description: newItemDesc,
      link: newItemLink,
      image: newItemImage
    }]);
    // Reset inputs
    setNewItemTitle('');
    setNewItemDesc('');
    setNewItemLink('');
    setNewItemImage('');
  };

  const removePortfolioItem = (index: number) => {
    setPortfolioItems(portfolioItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    // Append complex states to FormData
    formData.append('show_resume', showResume.toString());
    formData.append('show_portfolio', showPortfolio.toString());
    formData.append('portfolio_items', JSON.stringify(portfolioItems));
    formData.append('resume_pdf_data', resumeData);
    
    await action(formData);
    setIsSubmitting(false);
  };

  return (
    <form action={handleSubmit} className="space-y-10">
      
      {/* Basic Info */}
      <div className="space-y-5 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3">Basic Information</h2>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Account Email</label>
          <input type="email" disabled value={userProfile.email} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Public Display Name</label>
          <input type="text" name="name" defaultValue={userProfile.name || ''} placeholder="e.g. Jane Doe" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Creator Bio (Short)</label>
          <textarea name="bio" rows={3} defaultValue={userProfile.bio || ''} placeholder="Tell students about your expertise..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition"></textarea>
        </div>
      </div>

      {/* Resume Section */}
      <div className="space-y-5 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xl font-bold text-slate-900">Resume & Experience</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm font-semibold text-slate-600">Show on Profile</span>
            <input type="checkbox" checked={showResume} onChange={(e) => setShowResume(e.target.checked)} className="w-5 h-5 accent-indigo-600" />
          </label>
        </div>

        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center">
          <FileText className="mx-auto text-slate-400 mb-2" size={32} />
          <h3 className="text-sm font-bold text-slate-700 mb-1">{pdfName || 'Upload PDF Resume'}</h3>
          <p className="text-xs text-slate-500 mb-4">Max size: 2MB</p>
          <label className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-100 transition cursor-pointer">
            <Upload size={16} /> Choose File
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
          </label>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">Or write a text-based resume</label>
          <textarea name="resume_text" rows={5} defaultValue={userProfile.resume_text || ''} placeholder="List your professional history, skills, and qualifications here..." className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition"></textarea>
        </div>
      </div>

      {/* Portfolio Section */}
      <div className="space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xl font-bold text-slate-900">Portfolio Details</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm font-semibold text-slate-600">Show on Profile</span>
            <input type="checkbox" checked={showPortfolio} onChange={(e) => setShowPortfolio(e.target.checked)} className="w-5 h-5 accent-indigo-600" />
          </label>
        </div>

        {/* Existing Items */}
        {portfolioItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolioItems.map((item, idx) => (
              <div key={idx} className="relative border border-slate-200 rounded-xl overflow-hidden shadow-sm group">
                <button type="button" onClick={() => removePortfolioItem(idx)} className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-sm z-10"><Trash2 size={14}/></button>
                {item.image && <img src={item.image} alt={item.title} className="w-full h-24 object-cover bg-slate-100" />}
                <div className="p-3">
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Item Mini-Form */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
           <h3 className="text-sm font-bold text-slate-800">Add Portfolio Item</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Project Title</label>
                <input type="text" value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="e.g. E-Commerce Platform" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Website URL</label>
                <input type="url" value={newItemLink} onChange={(e) => setNewItemLink(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Brief Description</label>
                <input type="text" value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} placeholder="What did you build?" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-slate-100 transition cursor-pointer">
                  {isUploadingImage ? 'Uploading...' : <><Upload size={14} /> Upload Image</>}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                </label>
                {newItemImage && <CheckCircle2 className="text-emerald-500" size={18} />}
              </div>
           </div>
           <button type="button" onClick={addPortfolioItem} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-slate-800 transition">
             <Plus size={16} /> Add to Portfolio
           </button>
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white rounded-xl py-4 text-sm font-bold shadow-md hover:bg-indigo-500 transition disabled:opacity-50">
        {isSubmitting ? 'Saving Profile...' : 'Save Complete Profile'}
      </button>
    </form>
  );
}