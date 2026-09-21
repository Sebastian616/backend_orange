const pool = require('../lib/db');

// GET /productos — lista pública con filtros
// query params opcionales:
//   categoria   -> id de categoría
//   q           -> busca en nombre (ILIKE, insensible a mayúsculas)
//   precioMin   -> precio mínimo
//   precioMax   -> precio máximo
//   orden       -> 'recientes' (default) | 'precio_asc' | 'precio_desc'
//   page        -> número de página (default 1)
//   limit       -> resultados por página (default 20, máx 50)
async function listar(req, res) {
  const { categoria, q, precioMin, precioMax, orden } = req.query;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = (page - 1) * limit;

  const condiciones = ['p.activo = true'];
  const params = [];

  if (categoria) {
    params.push(categoria);
    condiciones.push(`p.categoria_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    condiciones.push(`p.nombre ILIKE $${params.length}`);
  }
  if (precioMin) {
    params.push(precioMin);
    condiciones.push(`p.precio >= $${params.length}`);
  }
  if (precioMax) {
    params.push(precioMax);
    condiciones.push(`p.precio <= $${params.length}`);
  }

  const ordenSql = {
    precio_asc: 'p.precio ASC',
    precio_desc: 'p.precio DESC',
    recientes: 'p.created_at DESC',
  }[orden] || 'p.created_at DESC';

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  try {
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM productos p ${where}`,
      params
    );
    const total = countRows[0].total;

    params.push(limit, offset);
    const { rows: productos } = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       ${where}
       ORDER BY ${ordenSql}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const idsProductos = productos.map((p) => p.id);
    let tallas = [];
    if (idsProductos.length > 0) {
      const { rows } = await pool.query(
        `SELECT pt.producto_id, t.id AS talla_id, t.nombre AS talla, pt.stock
         FROM producto_tallas pt
         JOIN tallas t ON t.id = pt.talla_id
         WHERE pt.producto_id = ANY($1::uuid[])`,
        [idsProductos]
      );
      tallas = rows;
    }

    const productosConTallas = productos.map((p) => ({
      ...p,
      tallas: tallas.filter((t) => t.producto_id === p.id),
    }));

    res.json({
      productos: productosConTallas,
      paginacion: { page, limit, total, totalPaginas: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar productos' });
  }
}

// GET /productos/:id
async function obtener(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    const producto = rows[0];
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const { rows: tallas } = await pool.query(
      `SELECT t.id AS talla_id, t.nombre AS talla, pt.stock
       FROM producto_tallas pt JOIN tallas t ON t.id = pt.talla_id
       WHERE pt.producto_id = $1`,
      [id]
    );

    res.json({ ...producto, tallas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
}

// POST /productos — solo admin. Crea el producto y su stock inicial por talla.
// body: { nombre, descripcion, precio, etiqueta, categoriaId, fotos: [], tallas: [{ tallaId, stock }] }
async function crear(req, res) {
  const { nombre, descripcion, precio, etiqueta, categoriaId, fotos, tallas } = req.body;

  if (!nombre || precio == null) {
    return res.status(400).json({ error: 'nombre y precio son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO productos (nombre, descripcion, precio, etiqueta, categoria_id, fotos)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, descripcion || null, precio, etiqueta || null, categoriaId || null, fotos || []]
    );
    const producto = rows[0];

    if (Array.isArray(tallas)) {
      for (const t of tallas) {
        await client.query(
          `INSERT INTO producto_tallas (producto_id, talla_id, stock)
           VALUES ($1, $2, $3)`,
          [producto.id, t.tallaId, t.stock || 0]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(producto);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al crear el producto' });
  } finally {
    client.release();
  }
}

// PUT /productos/:id — solo admin. Edita los campos del producto.
// Solo actualiza los campos que vengan en el body (los que falten no se tocan).
// No toca tallas/stock aquí — eso ya lo maneja productoTallaController.js
// (PUT /productos/:id/tallas/:tallaId).
// body: { nombre?, descripcion?, precio?, etiqueta?, categoriaId?, fotos? }
async function actualizar(req, res) {
  const { id } = req.params;
  const { nombre, descripcion, precio, etiqueta, categoriaId, fotos } = req.body;

  if (precio != null && precio < 0) {
    return res.status(400).json({ error: 'El precio no puede ser negativo' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE productos
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           precio = COALESCE($3, precio),
           etiqueta = COALESCE($4, etiqueta),
           categoria_id = COALESCE($5, categoria_id),
           fotos = COALESCE($6, fotos),
           updated_at = now()
       WHERE id = $7
       RETURNING *`,
      [
        nombre ?? null,
        descripcion ?? null,
        precio ?? null,
        etiqueta ?? null,
        categoriaId ?? null,
        fotos ?? null,
        id,
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
}

// DELETE /productos/:id — solo admin. Desactiva el producto (soft delete).
// No se borra de verdad: si el producto ya está en algún pedido_detalle,
// un borrado real fallaría por la llave foránea (pedido_detalle.producto_id
// no tiene ON DELETE CASCADE). Al desactivarlo, deja de aparecer en
// /productos (que ya filtra activo = true) pero el historial de pedidos
// que lo incluyen sigue intacto.
async function eliminar(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE productos
       SET activo = false, updated_at = now()
       WHERE id = $1
       RETURNING id, nombre, activo`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto desactivado', producto: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desactivar el producto' });
  }
}

// PATCH /productos/:id/reactivar — solo admin. Por si te arrepientes de eliminarlo.
async function reactivar(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE productos
       SET activo = true, updated_at = now()
       WHERE id = $1
       RETURNING id, nombre, activo`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto reactivado', producto: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reactivar el producto' });
  }
}

// GET /productos/admin/todos — solo admin. Igual que listar(), pero SIN
// filtrar por activo=true, para que el panel pueda ver y reactivar
// productos desactivados. Sin paginación: se asume un catálogo manejable.
async function listarAdmin(req, res) {
  try {
    const { rows: productos } = await pool.query(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      ORDER BY p.created_at DESC
    `);

    res.json(productos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar productos' });
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar, reactivar, listarAdmin };