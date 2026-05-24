'use client';




import { useState } from 'react';
import { Trash2, Plus, Upload, FileText, CheckCircle2, UserCircle, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfileSettingsForm({ userProfile, action }: { userProfile: any, action: (formData: FormData) => Promise<void> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResume, setShowResume] = useState(userProfile.show_resume ?? true);
  const [showPortfolio, setShowPortfolio] = useState(userProfile.show_portfolio ?? true);
  
  const [resumeData, setResumeData] = useState(userProfile.resume_pdf_data || '');
  const [pdfName, setPdfName] = useState(userProfile.resume_pdf_data ? 'Existing PDF Resume' : '');
  
  const [profileImage, setProfileImage] = useState(userProfile.profile_picture_url || '');
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  const initialItems = typeof userProfile.portfolio_items === 'string' 
    ? JSON.parse(userProfile.portfolio_items) 
    : (userProfile.portfolio_items || []);
  const [portfolioItems, setPortfolioItems] = useState<any[]>(initialItems);

  // Form State for Adding / Editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [newItemImage, setNewItemImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Reusable ImgBB Upload Handler
  const uploadToImgBB = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=b2492f987920d3e2a7903861b72ae3a4`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    return data.success ? data.data.url : null;
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProfile(true);
    const url = await uploadToImgBB(file);
    if (url) setProfileImage(url);
    setIsUploadingProfile(false);
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Please keep PDF size under 2MB for optimal performance.");
      return;
    }
    setPdfName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => setResumeData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePortfolioImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const url = await uploadToImgBB(file);
    if (url) setNewItemImage(url);
    setIsUploadingImage(false);
  };

  const loadItemForEdit = (index: number) => {
    const item = portfolioItems[index];
    setNewItemTitle(item.title);
    setNewItemDesc(item.description);
    setNewItemLink(item.link || '');
    setNewItemImage(item.image || '');
    setEditingIndex(index);
  };

  const savePortfolioItem = () => {
    if (!newItemTitle) return;
    
    const newEntry = {
      title: newItemTitle,
      description: newItemDesc,
      link: newItemLink,
      image: newItemImage
    };

    if (editingIndex !== null) {
      const updated = [...portfolioItems];
      updated[editingIndex] = newEntry;
      setPortfolioItems(updated);
      setEditingIndex(null);
    } else {
      setPortfolioItems([...portfolioItems, newEntry]);
    }
    
    // Reset Form
    setNewItemTitle('');
    setNewItemDesc('');
    setNewItemLink('');
    setNewItemImage('');
  };

  const removePortfolioItem = (index: number) => {
    setPortfolioItems(portfolioItems.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setNewItemTitle('');
      setNewItemDesc('');
      setNewItemLink('');
      setNewItemImage('');
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setNewItemTitle('');
    setNewItemDesc('');
    setNewItemLink('');
    setNewItemImage('');
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    formData.append('show_resume', showResume.toString());
    formData.append('show_portfolio', showPortfolio.toString());
    formData.append('portfolio_items', JSON.stringify(portfolioItems));
    formData.append('resume_pdf_data', resumeData);
    formData.append('profile_picture_url', profileImage);
    
    await action(formData);
    toast.success('Profile saved successfully!');
    setIsSubmitting(false);
  };

  return (
    <form action={handleSubmit} className="space-y-10">
      
      {/* Basic Info & Profile Picture */}
      <div className="space-y-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3">Basic Information</h2>
        
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start bg-slate-50 p-6 rounded-xl border border-slate-200 border-dashed">
          <div className="relative">
            {profileImage ? (
               <img src={profileImage} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
            ) : (
               <div className="w-24 h-24 rounded-full bg-indigo-100 text-indigo-400 flex items-center justify-center border-4 border-white shadow-md">
                 <UserCircle size={48} />
               </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Profile Avatar</h3>
            <p className="text-xs text-slate-500 mb-4">This will be displayed as a large banner on your public profile page.</p>
            <label className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-100 transition cursor-pointer">
              {isUploadingProfile ? 'Uploading...' : <><Upload size={16} /> Upload Photo</>}
              <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} disabled={isUploadingProfile} />
            </label>
          </div>
        </div>

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
              <div key={idx} className={`relative border rounded-xl overflow-hidden shadow-sm group transition-all ${editingIndex === idx ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}>
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                   <button type="button" onClick={() => loadItemForEdit(idx)} className="bg-indigo-500 text-white p-1.5 rounded-lg shadow-sm hover:bg-indigo-600"><Pencil size={14}/></button>
                   <button type="button" onClick={() => removePortfolioItem(idx)} className="bg-rose-500 text-white p-1.5 rounded-lg shadow-sm hover:bg-rose-600"><Trash2 size={14}/></button>
                </div>
                {item.image && <img src={item.image} alt={item.title} className="w-full h-24 object-cover bg-slate-100" />}
                <div className="p-3">
                  <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit New Item Mini-Form */}
        <div className={`border rounded-xl p-5 space-y-4 transition-colors ${editingIndex !== null ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
           <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{editingIndex !== null ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</h3>
              {editingIndex !== null && (
                 <button type="button" onClick={cancelEdit} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel Edit</button>
              )}
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Project Title</label>
                <input type="text" value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="e.g. E-Commerce Platform" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Website URL</label>
                <input type="url" value={newItemLink} onChange={(e) => setNewItemLink(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Detailed Description</label>
                <textarea rows={4} value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} placeholder="What did you build? Explain your process..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"></textarea>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200/60 pt-4">
                <label className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-slate-100 transition cursor-pointer">
                  {isUploadingImage ? 'Uploading...' : <><Upload size={14} /> Upload Cover Image</>}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePortfolioImageUpload} disabled={isUploadingImage} />
                </label>
                {newItemImage && <CheckCircle2 className="text-emerald-500" size={18} />}
              </div>
           </div>
           <button type="button" onClick={savePortfolioItem} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg py-2.5 text-sm font-bold hover:bg-slate-800 transition">
             {editingIndex !== null ? 'Save Changes' : <><Plus size={16} /> Add to Portfolio</>}
           </button>
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white rounded-xl py-4 text-sm font-bold shadow-md hover:bg-indigo-500 transition disabled:opacity-50">
        {isSubmitting ? 'Saving Profile...' : 'Save Complete Profile'}
      </button>
    </form>
  );
}