const pool = require('../lib/db');

async function listar(req, res) {
  try {
    const { rows } = await pool.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar categorías' });
  }
}

async function crear(req, res) {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO categorias (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esa categoría ya existe' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
}

async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });

  try {
    const { rows } = await pool.query(
      'UPDATE categorias SET nombre = $1 WHERE id = $2 RETURNING *',
      [nombre, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
}

async function eliminar(req, res) {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM categorias WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };