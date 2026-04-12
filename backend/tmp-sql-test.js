import mysql from 'mysql2/promise';
import { config } from './src/config.js';

const db = await mysql.createPool(config.db);
try {
  const query = `
      INSERT INTO members
      (full_name, membership_type, join_date, status, assigned_trainer_id, phone, email, profile_picture, emergency_contact, notes)
      VALUES
      (?, ?, ?, 'active', NULL, ?, ?, NULL, NULL, NULL)
    `;
  console.log('placeholders', (query.match(/\?/g) || []).length);
  const params = ['Test User', 'monthly', '2026-04-08', null, null];
  console.log('params', params.length);
  const [result] = await db.execute(query, params);
  console.log('ok', result);
} catch (e) {
  console.error(e);
} finally {
  await db.end();
}
