import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../types.js';

export function roleGuard(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

export function branchGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (req.user.role === 'super_admin') {
    return next();
  }
  const branchId = req.params.branchId || req.body?.branch_id;
  if (branchId && req.user.branchId !== branchId) {
    return res.status(403).json({ error: 'No tienes acceso a esta sucursal' });
  }
  next();
}

export function cronGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET no configurado en el servidor' });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  next();
}
