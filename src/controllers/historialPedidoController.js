const pool = require('../lib/db');

// GET /pedidos/:id/historial
async function obtenerHistorial(req, res) {
  const { id } = req.params;
  const usuarioId = req.usuario.id;
  const esAdmin = req.usuario.rol === 'ADMIN';

  try {
    // Solo el dueño del pedido o un ADMIN pueden ver el historial
    const pedido = await pool.query(
      'SELECT id, usuario_id FROM pedidos WHERE id = $1',
      [id]
    );

    if (pedido.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    if (!esAdmin && pedido.rows[0].usuario_id !== usuarioId) {
      return res.status(403).json({ error: 'No tienes acceso a este pedido' });
    }

    const { rows } = await pool.query(
      `SELECT id, estado, comentario, created_at
       FROM historial_estado_pedido
       WHERE pedido_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el historial del pedido' });
  }
}

module.exports = { obtenerHistorial };