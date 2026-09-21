const pool = require('../lib/db');

// GET /productos/:productoId/tallas
async function listarPorProducto(req, res) {
  const { productoId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT pt.id, pt.stock, t.id AS talla_id, t.nombre AS talla
       FROM producto_tallas pt
       JOIN tallas t ON t.id = pt.talla_id
       WHERE pt.producto_id = $1
       ORDER BY t.nombre`,
      [productoId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar las tallas del producto' });
  }
}

// POST /productos/:productoId/tallas  (solo ADMIN)
// body: { tallaId, stock }
async function asignarTalla(req, res) {
  const { productoId } = req.params;
  const { tallaId, stock } = req.body;

  if (!tallaId || stock === undefined || stock < 0) {
    return res.status(400).json({ error: 'tallaId y stock (>= 0) son requeridos' });
  }

  try {
    const producto = await pool.query('SELECT id FROM productos WHERE id = $1', [productoId]);
    if (producto.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const { rows } = await pool.query(
      `INSERT INTO producto_tallas (producto_id, talla_id, stock)
       VALUES ($1, $2, $3)
       RETURNING id, producto_id, talla_id, stock`,
      [productoId, tallaId, stock]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esa talla ya está asignada a este producto' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al asignar la talla' });
  }
}

// PUT /productos/:productoId/tallas/:tallaId  (solo ADMIN)
// body: { stock }
async function actualizarStock(req, res) {
  const { productoId, tallaId } = req.params;
  const { stock } = req.body;

  if (stock === undefined || stock < 0) {
    return res.status(400).json({ error: 'stock (>= 0) es requerido' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE producto_tallas
       SET stock = $1
       WHERE producto_id = $2 AND talla_id = $3
       RETURNING id, producto_id, talla_id, stock`,
      [stock, productoId, tallaId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Esa talla no está asignada a este producto' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el stock' });
  }
}

// DELETE /productos/:productoId/tallas/:tallaId  (solo ADMIN)
async function quitarTalla(req, res) {
  const { productoId, tallaId } = req.params;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM producto_tallas WHERE producto_id = $1 AND talla_id = $2',
      [productoId, tallaId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Esa talla no está asignada a este producto' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al quitar la talla' });
  }
}

module.exports = {
  listarPorProducto,
  asignarTalla,
  actualizarStock,
  quitarTalla,
};