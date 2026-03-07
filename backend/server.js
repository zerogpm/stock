import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import stockRouter from './routes/stock.js';
import newsRouter from './routes/news.js';
import analyzeRouter from './routes/analyze.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/stock', stockRouter);
app.use('/api/news', newsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/search', (await import('./routes/search.js')).default);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
