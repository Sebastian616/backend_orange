const pool = require('../lib/db');

// GET /usuarios/me
async function obtenerPerfil(req, res) {
  const usuarioId = req.usuario.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, correo, whatsapp, rol, correo_verificado, created_at
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
}

// PUT /usuarios/me
async function actualizarPerfil(req, res) {
  const usuarioId = req.usuario.id;
  const { nombre, whatsapp } = req.body;

  if (!nombre && !whatsapp) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE usuarios
       SET nombre = COALESCE($1, nombre),
           whatsapp = COALESCE($2, whatsapp),
           updated_at = now()
       WHERE id = $3
       RETURNING id, nombre, correo, whatsapp, rol, correo_verificado, created_at`,
      [nombre || null, whatsapp || null, usuarioId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
}

// GET /usuarios  (solo ADMIN)
async function listar(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, correo, whatsapp, rol, correo_verificado, created_at
       FROM usuarios
       ORDER BY created_at DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

// PATCH /usuarios/:id/rol  (solo ADMIN)
async function cambiarRol(req, res) {
  const { id } = req.params;
  const { rol } = req.body;

  if (!['CLIENTE', 'ADMIN'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE usuarios
       SET rol = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, nombre, correo, rol`,
      [rol, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar el rol' });
  }
}

module.exports = {
  obtenerPerfil,
  actualizarPerfil,
  listar,
  cambiarRol,
};