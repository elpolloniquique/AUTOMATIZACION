import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from './authMiddleware.js';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function assertBranchAccess(user: AuthUser, branchId: string): void {
  if (user.role === 'super_admin') return;
  if (!user.branchId || user.branchId !== branchId) {
    throw new HttpError(403, 'No tienes acceso a esta sucursal');
  }
}

export async function getPostBranchId(supabase: SupabaseClient, postId: string): Promise<string> {
  const { data, error } = await supabase.from('posts').select('branch_id').eq('id', postId).single();
  if (error || !data) throw new HttpError(404, 'Publicación no encontrada');
  return data.branch_id as string;
}
