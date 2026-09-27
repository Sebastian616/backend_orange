const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa a Supabase!');
    console.log('Hora del servidor de DB:', res.rows[0].now);
  } catch (error) {
    console.error('❌ Error al conectar:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();