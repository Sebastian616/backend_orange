const pool = require('../lib/db');

// GET /favoritos — favoritos del usuario autenticado, con datos del producto
async function listarMios(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.created_at, p.*
       FROM favoritos f
       JOIN productos p ON p.id = f.producto_id
       WHERE f.usuario_id = $1
       ORDER BY f.created_at DESC`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar favoritos' });
  }
}

// POST /favoritos — body: { productoId }
async function agregar(req, res) {
  const { productoId } = req.body;
  if (!productoId) return res.status(400).json({ error: 'productoId es requerido' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO favoritos (usuario_id, producto_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, producto_id) DO NOTHING
       RETURNING *`,
      [req.usuario.id, productoId]
    );
    res.status(201).json(rows[0] || { mensaje: 'Ya estaba en tus favoritos' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar a favoritos' });
  }
}

// DELETE /favoritos/:productoId
async function quitar(req, res) {
  const { productoId } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM favoritos WHERE usuario_id = $1 AND producto_id = $2',
      [req.usuario.id, productoId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'No estaba en tus favoritos' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al quitar de favoritos' });
  }
}

module.exports = { listarMios, agregar, quitar };