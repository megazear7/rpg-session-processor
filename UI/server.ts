import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// TODO: Add API endpoints for session processing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RPG Session Processor UI server running' });
});

app.listen(PORT, () => {
  console.log(`Zelt Stack UI server running at http://localhost:${PORT}`);
});
