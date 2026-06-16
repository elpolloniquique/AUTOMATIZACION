import { Request, Response, NextFunction } from 'express';
import { createUserClient } from './supabase.js';
import type { UserRole } from '../types.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  branchId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = createUserClient(token);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, branch_id, email, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Perfil de usuario no encontrado' });
    }

    req.user = {
      id: user.id,
      email: profile.email || user.email || '',
      role: profile.role as UserRole,
      branchId: profile.branch_id,
    };

    next();
  } catch {
    return res.status(500).json({ error: 'Error de autenticación' });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  return authMiddleware(req, res, next);
}
