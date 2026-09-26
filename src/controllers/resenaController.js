const pool = require('../lib/db');

// GET /productos/:productoId/resenas
async function listarPorProducto(req, res) {
  const { productoId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.calificacion, r.comentario, r.created_at,
              u.nombre AS usuario_nombre
       FROM resenas r
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.producto_id = $1
       ORDER BY r.created_at DESC`,
      [productoId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar las reseñas' });
  }
}

// GET /productos/:productoId/resenas/resumen
async function resumenPorProducto(req, res) {
  const { productoId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total_resenas,
              COALESCE(ROUND(AVG(calificacion)::numeric, 2), 0) AS promedio
       FROM resenas
       WHERE producto_id = $1`,
      [productoId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el resumen de reseñas' });
  }
}

// POST /productos/:productoId/resenas  (requiere auth)
async function crear(req, res) {
  const { productoId } = req.params;
  const usuarioId = req.usuario.id;
  const { calificacion, comentario } = req.body;

  if (!calificacion || calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5' });
  }

  try {
    const producto = await pool.query(
      'SELECT id FROM productos WHERE id = $1 AND activo = true',
      [productoId]
    );
    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Solo puede reseñar quien tenga un pedido ENTREGADO que incluya este producto
    const compraEntregada = await pool.query(
      `SELECT 1
       FROM pedido_detalle pd
       JOIN pedidos p ON p.id = pd.pedido_id
       WHERE pd.producto_id = $1 AND p.usuario_id = $2 AND p.estado = 'ENTREGADO'
       LIMIT 1`,
      [productoId, usuarioId]
    );
    if (compraEntregada.rows.length === 0) {
      return res.status(403).json({
        error: 'Solo puedes reseñar productos que hayas comprado y que ya te hayan entregado',
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO resenas (usuario_id, producto_id, calificacion, comentario)
       VALUES ($1, $2, $3, $4)
       RETURNING id, calificacion, comentario, created_at`,
      [usuarioId, productoId, calificacion, comentario || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya dejaste una reseña para este producto' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la reseña' });
  }
}

// PUT /resenas/:id  (solo el dueño de la reseña, requiere auth)
async function actualizar(req, res) {
  const { id } = req.params;
  const usuarioId = req.usuario.id;
  const { calificacion, comentario } = req.body;

  if (calificacion !== undefined && (calificacion < 1 || calificacion > 5)) {
    return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE resenas
       SET calificacion = COALESCE($1, calificacion),
           comentario = COALESCE($2, comentario)
       WHERE id = $3 AND usuario_id = $4
       RETURNING id, calificacion, comentario, created_at`,
      [calificacion ?? null, comentario ?? null, id, usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Reseña no encontrada' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la reseña' });
  }
}

// DELETE /resenas/:id  (solo el dueño de la reseña, requiere auth)
async function eliminar(req, res) {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM resenas WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Reseña no encontrada' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la reseña' });
  }
}

// GET /productos/:productoId/resenas/puedo-resenar  (requiere auth)
// Le dice al frontend si debe mostrar el formulario de reseña:
// - puedeResenar: compró el producto y ya se lo entregaron
// - yaReseno: ya dejó una reseña antes (evita mostrar el form dos veces)
async function puedoResenar(req, res) {
  const { productoId } = req.params;
  const usuarioId = req.usuario.id;

  try {
    const compraEntregada = await pool.query(
      `SELECT 1
       FROM pedido_detalle pd
       JOIN pedidos p ON p.id = pd.pedido_id
       WHERE pd.producto_id = $1 AND p.usuario_id = $2 AND p.estado = 'ENTREGADO'
       LIMIT 1`,
      [productoId, usuarioId]
    );

    const resenaExistente = await pool.query(
      'SELECT id FROM resenas WHERE producto_id = $1 AND usuario_id = $2',
      [productoId, usuarioId]
    );

    res.json({
      puedeResenar: compraEntregada.rows.length > 0,
      yaReseno: resenaExistente.rows.length > 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar si puedes reseñar este producto' });
  }
}

module.exports = {
  listarPorProducto,
  resumenPorProducto,
  crear,
  actualizar,
  eliminar,
  puedoResenar,
};