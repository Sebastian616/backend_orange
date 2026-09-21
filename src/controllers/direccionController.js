const pool = require('../lib/db');

// GET /direcciones — direcciones del usuario autenticado
async function listarMias(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM direcciones WHERE usuario_id = $1 ORDER BY created_at DESC',
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar direcciones' });
  }
}

// POST /direcciones
async function crear(req, res) {
  const { alias, direccion, ciudad, departamento, referencia } = req.body;
  if (!alias || !direccion || !ciudad) {
    return res.status(400).json({ error: 'alias, direccion y ciudad son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO direcciones (usuario_id, alias, direccion, ciudad, departamento, referencia)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.usuario.id, alias, direccion, ciudad, departamento || null, referencia || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la dirección' });
  }
}

// PUT /direcciones/:id — solo si la dirección es del usuario autenticado
async function actualizar(req, res) {
  const { id } = req.params;
  const { alias, direccion, ciudad, departamento, referencia } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE direcciones
       SET alias = COALESCE($1, alias),
           direccion = COALESCE($2, direccion),
           ciudad = COALESCE($3, ciudad),
           departamento = COALESCE($4, departamento),
           referencia = COALESCE($5, referencia)
       WHERE id = $6 AND usuario_id = $7
       RETURNING *`,
      [alias, direccion, ciudad, departamento, referencia, id, req.usuario.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Dirección no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar la dirección' });
  }
}

// DELETE /direcciones/:id
async function eliminar(req, res) {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM direcciones WHERE id = $1 AND usuario_id = $2',
      [id, req.usuario.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Dirección no encontrada' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la dirección' });
  }
}

module.exports = { listarMias, crear, actualizar, eliminar };