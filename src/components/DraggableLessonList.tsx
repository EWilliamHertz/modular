'use client';

import { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateLessonOrderAction, deleteLessonAction } from '@/app/actions';

function SortableLessonItem({ lesson, index }: { lesson: any, index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`p-5 bg-white border rounded-xl flex items-center justify-between group transition-shadow cursor-grab active:cursor-grabbing mb-3 ${isDragging ? 'shadow-lg border-indigo-500 opacity-90' : 'border-slate-200 shadow-sm hover:border-indigo-300'}`}
    >
      <div className="flex items-center gap-4">
        <div className="text-slate-400 font-bold bg-slate-100 w-10 h-10 flex items-center justify-center rounded-lg">{index + 1}</div>
        <div>
          <div className="font-bold text-slate-900 text-lg mb-0.5">{lesson.title}</div>
          <div className="text-sm text-slate-500 line-clamp-1">
            {lesson.content_json?.html ? lesson.content_json.html.replace(/<[^>]*>?/gm, '') : (lesson.content_json?.text || 'No text content')}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 pr-2">
        <button 
          onClick={(e) => {
             e.stopPropagation();
             deleteLessonAction(lesson.id);
          }}
          className="text-slate-300 hover:text-rose-500 transition p-2 cursor-pointer relative z-20"
          title="Delete Lesson"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
        </button>
        <div className="text-slate-300 group-hover:text-indigo-500 transition-colors flex flex-col items-center gap-1 cursor-grab">
           <span className="text-[10px] font-bold uppercase tracking-wider">Drag</span>
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line></svg>
        </div>
      </div>
    </div>
  );
}

export default function DraggableLessonList({ initialLessons }: { initialLessons: any[] }) {
  const [lessons, setLessons] = useState(initialLessons);

  // Sync state if a new lesson is added via the server action form
  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = lessons.findIndex((l) => l.id === active.id);
      const newIndex = lessons.findIndex((l) => l.id === over.id);

      const newOrder = arrayMove(lessons, oldIndex, newIndex);
      setLessons(newOrder);

      // Map the new array into a payload for the database
      const updates = newOrder.map((lesson, index) => ({
        id: lesson.id,
        sort_order: index
      }));

      // Fire server action silently in the background
      await updateLessonOrderAction(updates);
    }
  }

  if (lessons.length === 0) {
    return (
      <div className="p-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl text-slate-500">
        <div className="font-bold text-lg mb-1 text-slate-700">No lessons created yet</div>
        <p className="text-sm">Use the panel on the right to add content modules.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div className="pt-2">
          {lessons.map((lesson, index) => (
            <SortableLessonItem key={lesson.id} lesson={lesson} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}