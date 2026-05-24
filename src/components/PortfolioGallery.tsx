'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

export default function PortfolioGallery({ items }: { items: any[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    if (selectedImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="group border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition hover:border-indigo-300 bg-white flex flex-col h-full">
            
            {/* Image (Click to Expand) */}
            {item.image ? (
              <div 
                className="cursor-zoom-in relative overflow-hidden" 
                onClick={() => setSelectedImage(item.image)}
              >
                <img src={item.image} alt={item.title} className="w-full h-48 object-cover border-b border-slate-100 group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                   <span className="opacity-0 group-hover:opacity-100 text-white font-bold tracking-wider text-xs bg-black/50 px-3 py-1.5 rounded-full transition-opacity backdrop-blur-sm">View Fullscreen</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-semibold">No Image Provided</div>
            )}
            
            {/* Text & Link Details */}
            <div className="p-6 flex-1 flex flex-col">
              <h4 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h4>
              <p className="text-sm text-slate-600 mb-6 flex-1 whitespace-pre-wrap">{item.description}</p>
              
              {item.link ? (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-bold shadow-sm hover:bg-slate-800 transition">
                  Visit Project <ExternalLink size={14} />
                </a>
              ) : (
                <div className="text-xs text-slate-400 italic text-center py-2.5">No link provided</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)} // Click outside to close
        >
          {/* Close Button */}
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition z-10"
            onClick={() => setSelectedImage(null)}
          >
            <X size={28} />
          </button>
          
          {/* Main Image */}
          <img 
            src={selectedImage} 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300 relative z-10 cursor-auto" 
            onClick={(e) => e.stopPropagation()} // Prevent clicking the image from closing the modal
            alt="Fullscreen portfolio view"
          />
        </div>
      )}
    </>
  );
}
