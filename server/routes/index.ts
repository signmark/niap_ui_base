import express from 'express';
import authRoutes from './auth';
import campaignsRoutes from './campaigns';
import keywordsRoutes from './keywords';
import trendsRoutes from './trends';
import storiesRoutes from './stories';
import { log } from '../utils/logger';

/**
 * Main Router Index
 * Registers all modular route handlers
 */
export function registerModularRoutes(app: express.Application) {
  log('routes', 'Registering modular routes...');

  // Authentication routes
  app.use('/api/auth', authRoutes);
  log('routes', '✓ Auth routes registered');

  // Campaign management routes
  app.use('/api/campaigns', campaignsRoutes);
  log('routes', '✓ Campaign routes registered');

  // Keywords management routes
  app.use('/api/keywords', keywordsRoutes);
  log('routes', '✓ Keywords routes registered');

  // Trends analysis routes
  app.use('/api/trends', trendsRoutes);
  log('routes', '✓ Trends routes registered');

  // Stories routes (existing)
  app.use('/api/stories', storiesRoutes);
  log('routes', '✓ Stories routes registered');

  log('routes', 'All modular routes registered successfully');
}