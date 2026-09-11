import express from 'express';
import { pool } from './db';
import { requireAuth } from './auth';

const router = express.Router();
const resources = ['assets', 'documents', 'trusted-people'] as const;
type Resource = (typeof resources)[number];

const isResource = (value: string): value is Resource => resources.includes(value as Resource);
const tableName = (resource: Resource) => resource.replace('-', '_');

router.use(requireAuth);

router.get('/:resource', async (req, res) => {
  if (!isResource(req.params.resource)) return res.status(404).json({ error: 'Vault resource not found.' });
  const result = await pool.query(
    `SELECT id, data, created_at, updated_at FROM ${tableName(req.params.resource)} WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.userId],
  );
  return res.json(result.rows.map((row) => ({ ...row.data, id: row.id })));
});

router.post('/:resource', async (req, res) => {
  if (!isResource(req.params.resource)) return res.status(404).json({ error: 'Vault resource not found.' });
  const result = await pool.query(
    `INSERT INTO ${tableName(req.params.resource)} (user_id, data) VALUES ($1, $2) RETURNING id, data, created_at, updated_at`,
    [req.userId, req.body],
  );
  const row = result.rows[0];
  return res.status(201).json({ ...row.data, id: row.id });
});

router.patch('/:resource/:id', async (req, res) => {
  if (!isResource(req.params.resource)) return res.status(404).json({ error: 'Vault resource not found.' });
  const result = await pool.query(
    `UPDATE ${tableName(req.params.resource)}
     SET data = data || $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, data`,
    [req.body, req.params.id, req.userId],
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Vault item not found.' });
  const row = result.rows[0];
  return res.json({ ...row.data, id: row.id });
});

router.delete('/:resource/:id', async (req, res) => {
  if (!isResource(req.params.resource)) return res.status(404).json({ error: 'Vault resource not found.' });
  const result = await pool.query(
    `DELETE FROM ${tableName(req.params.resource)} WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.userId],
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Vault item not found.' });
  return res.status(204).send();
});

export default router;
