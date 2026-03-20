import { Router } from 'express';
import {
  loadProfiles, invalidateCache,
  getIndustryProfile, getTickerProfile,
  putIndustryProfile, putTickerProfile,
  deleteIndustryProfile, deleteTickerProfile,
} from '../utils/stockProfiles.js';

const router = Router();

// GET /api/profiles — list all profiles
router.get('/', async (req, res) => {
  const profiles = await loadProfiles();
  res.json(profiles);
});

// GET /api/profiles/industry/:key
router.get('/industry/:key', async (req, res) => {
  const profile = await getIndustryProfile(req.params.key);
  if (!profile) return res.status(404).json({ error: 'Industry profile not found' });
  res.json({ key: req.params.key, ...profile });
});

// GET /api/profiles/ticker/:symbol
router.get('/ticker/:symbol', async (req, res) => {
  const upper = req.params.symbol.toUpperCase();
  const profile = await getTickerProfile(upper);
  if (!profile) return res.status(404).json({ error: 'Ticker profile not found' });
  res.json({ symbol: upper, ...profile });
});

// PUT /api/profiles/industry/:key — create or update
router.put('/industry/:key', async (req, res) => {
  const key = req.params.key;
  const result = await putIndustryProfile(key, req.body);
  res.json({ key, ...result });
});

// PUT /api/profiles/ticker/:symbol — create or update
router.put('/ticker/:symbol', async (req, res) => {
  const upper = req.params.symbol.toUpperCase();
  const result = await putTickerProfile(upper, req.body);
  res.json({ symbol: upper, ...result });
});

// DELETE /api/profiles/industry/:key
router.delete('/industry/:key', async (req, res) => {
  const deleted = await deleteIndustryProfile(req.params.key);
  if (!deleted) return res.status(404).json({ error: 'Industry profile not found' });
  res.json({ deleted: req.params.key });
});

// DELETE /api/profiles/ticker/:symbol
router.delete('/ticker/:symbol', async (req, res) => {
  const upper = req.params.symbol.toUpperCase();
  const deleted = await deleteTickerProfile(upper);
  if (!deleted) return res.status(404).json({ error: 'Ticker profile not found' });
  res.json({ deleted: upper });
});

export default router;
