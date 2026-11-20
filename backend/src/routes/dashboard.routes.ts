import { Router } from 'express';
import type { Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { getDashboardSummary, getNotificationsData } from '../services/dashboard.service';

const router = Router();

// UI-01 / UI-02: зведена статистика для дашборду
router.get('/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  res.json(await getDashboardSummary(req.user!.id));
});

// UI-03: найближче відключення та критичні прилади для Smart-сповіщень
router.get('/notifications', authenticateToken, async (req: AuthRequest, res: Response) => {
  res.json(await getNotificationsData(req.user!.id));
});

export default router;
