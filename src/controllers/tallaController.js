const pool = require('../lib/db');

async function listar(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM tallas ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar tallas' });
  }
}

async function crear(req, res) {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO tallas (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esa talla ya existe' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la talla' });
  }
}

module.exports = { listar, crear };