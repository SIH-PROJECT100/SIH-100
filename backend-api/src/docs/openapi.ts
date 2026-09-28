import { Router, Request, Response } from 'express';

export const docsRouter = Router();

docsRouter.get('/api-docs', (_req: Request, res: Response) => {
  res.status(200).json({
    openapi: '3.0.0',
    info: {
      title: 'BharatBid Sovereign E-Procurement API',
      version: '1.0.0',
      description: 'Automated multi-agency statutory compliance verification & trust ledger API for Government e-Marketplace (GeM).',
    },
    endpoints: [
      { path: '/auth/login', method: 'POST', description: 'Authenticate user and receive JWT session' },
      { path: '/health', method: 'GET', description: 'System health check and database round-trip' },
      { path: '/tenders', method: 'GET', description: 'Browse open procurement tenders' },
      { path: '/bidders', method: 'GET', description: 'Browse bidders, risk scores, and check statuses' },
      { path: '/ledger', method: 'GET', description: 'Access immutable audit trust ledger' },
      { path: '/uploads', method: 'POST', description: 'Upload PAN/GST/Udyam statutory documents' },
    ],
  });
});
