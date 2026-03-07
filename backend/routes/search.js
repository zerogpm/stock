import { Router } from 'express';
import { searchSymbols } from '../services/yahooFinance.js';

const router = Router();

router.get('/:query', async (req, res) => {
  try {
    const results = await searchSymbols(req.params.query);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.json([]);
  }
});

export default router;
