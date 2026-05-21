'use server';

import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function updateLessonOrderAction(updates: { id: number; sort_order: number }[]) {
  try {
    for (const update of updates) {
      await query('UPDATE lessons SET sort_order = $1 WHERE id = $2', [update.sort_order, update.id]);
    }
    revalidatePath('/');
  } catch (error) {
    console.error('Failed to update lesson order:', error);
  }
}

export async function deleteLessonAction(lessonId: number) {
  try {
    await query('DELETE FROM lessons WHERE id = $1', [lessonId]);
    revalidatePath('/');
  } catch (error) {
    console.error('Failed to delete lesson:', error);
  }
}

export async function createLessonAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) return;

  const courseId = formData.get('courseId');
  const title = formData.get('title');
  const content = formData.get('content');

  if (!courseId || !title) return;

  // Security Check: Verify user owns the course before adding a lesson
  const courseRes = await query('SELECT id FROM courses WHERE id = $1 AND creator_id = $2', [courseId, session.user.email]);
  if (courseRes.rowCount === 0) throw new Error("Unauthorized");

  try {
    await query(`
      INSERT INTO lessons (course_id, title, content_json, sort_order)
      VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons WHERE course_id = $1))
    `, [courseId, title, JSON.stringify({ html: content })]);
    revalidatePath('/');
  } catch (error) {
    console.error('Error adding lesson:', error);
  }
}