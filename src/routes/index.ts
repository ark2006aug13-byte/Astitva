import { Router } from 'express';
import authRoutes from './auth.routes';
import supabaseRoutes from './supabase.routes';

const router = Router();

// Mount authentication and onboarding routes
router.use('/auth', authRoutes);

// Mount Supabase user data & resume routes
router.use('/supabase', supabaseRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'SentinelApply Backend Engine',
    step: 'A1_A2_CORE_SECURITY',
    timestamp: new Date().toISOString(),
  });
});

export default router;
