'use server';

import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateLessonOrderAction(updates: { id: number; sort_order: number }[]) {
  try {
    for (const update of updates) {
      await query('UPDATE lessons SET sort_order = $1 WHERE id = $2', [update.sort_order, update.id]);
    }
    // Revalidate the cache so the course viewer gets the new order instantly
    revalidatePath('/');
  } catch (error) {
    console.error('Failed to update lesson order:', error);
  }
}