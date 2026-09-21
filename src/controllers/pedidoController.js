const pool = require('../lib/db');
const { crearPedido, listarPedidosUsuario, cambiarEstadoPedido } = require('../services/pedidoService');

// POST /pedidos — requiere estar autenticado
// body: { direccionId, items: [{ productoId, tallaId, cantidad }], costoEnvio }
async function crear(req, res) {
  const { direccionId, items, costoEnvio } = req.body;
  const usuarioId = req.usuario.id;

  try {
    const pedido = await crearPedido({ usuarioId, direccionId, items, costoEnvio });
    res.status(201).json(pedido);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

// GET /pedidos — pedidos del usuario autenticado
async function listarMios(req, res) {
  try {
    const pedidos = await listarPedidosUsuario(req.usuario.id);
    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar pedidos' });
  }
}

// GET /pedidos/admin/todos — solo ADMIN. Filtro opcional ?estado=PENDIENTE
async function listarTodos(req, res) {
  const { estado } = req.query;

  try {
    const params = [];
    let where = '';
    if (estado) {
      params.push(estado);
      where = 'WHERE p.estado = $1';
    }

    const { rows } = await pool.query(
      `SELECT p.*, u.nombre AS usuario_nombre, u.correo AS usuario_correo
       FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar pedidos' });
  }
}

// GET /pedidos/:id — dueño del pedido o ADMIN
async function obtenerPorId(req, res) {
  const { id } = req.params;
  const usuarioId = req.usuario.id;
  const esAdmin = req.usuario.rol === 'ADMIN';

  try {
    const { rows } = await pool.query('SELECT * FROM pedidos WHERE id = $1', [id]);
    const pedido = rows[0];

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (!esAdmin && pedido.usuario_id !== usuarioId) {
      return res.status(403).json({ error: 'No tienes acceso a este pedido' });
    }

    const { rows: detalles } = await pool.query(
      `SELECT pd.*, p.nombre AS producto_nombre, t.nombre AS talla
       FROM pedido_detalle pd
       JOIN productos p ON p.id = pd.producto_id
       JOIN tallas t ON t.id = pd.talla_id
       WHERE pd.pedido_id = $1`,
      [id]
    );

    res.json({ ...pedido, detalles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el pedido' });
  }
}

// PATCH /pedidos/:id/estado — solo ADMIN
// body: { estado, comentario }
async function cambiarEstado(req, res) {
  const { id } = req.params;
  const { estado, comentario } = req.body;

  try {
    const pedido = await cambiarEstadoPedido({ pedidoId: id, nuevoEstado: estado, comentario });
    res.json(pedido);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
}

// GET /pedidos/:id/historial — dueño del pedido o ADMIN
async function obtenerHistorial(req, res) {
  const { id } = req.params;
  const usuarioId = req.usuario.id;
  const esAdmin = req.usuario.rol === 'ADMIN';

  try {
    const pedido = await pool.query('SELECT id, usuario_id FROM pedidos WHERE id = $1', [id]);

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

module.exports = { crear, listarMios, listarTodos, obtenerPorId, cambiarEstado, obtenerHistorial };