const pool = require('../lib/db');

const ESTADOS_VALIDOS = [
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO',
];

// Reglas de envío. El servidor es quien decide el costo: se ignora cualquier
// costoEnvio que mande el frontend. Si cambias estos valores, cámbialos
// también en el frontend (src/config/envio.js) para que la barra y el banner coincidan.
const ENVIO_GRATIS_DESDE = 80000; // subtotal de productos, en pesos
const COSTO_ENVIO_ESTANDAR = 100;

// Descuento de bienvenida: % sobre el subtotal de productos, solo en la primera compra.
const DESCUENTO_BIENVENIDA_PORCENTAJE = 10;

// Métodos de pago. EFECTIVO y TRANSFERENCIA: el pedido queda PENDIENTE y la tienda
// confirma el pago. TARJETA: se cobra con Mercado Pago y el pedido pasa a CONFIRMADO
// cuando el pago se aprueba.
const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];
const ETIQUETA_METODO = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  TARJETA: 'tarjeta (Mercado Pago)',
};

// Los pedidos con tarjeta que no se paguen a tiempo se cancelan y el stock se devuelve.
// El pago en Mercado Pago expira a los MINUTOS_PARA_PAGAR; se espera un margen extra
// antes de cancelar, para no cancelar un pedido justo cuando alguien está pagando.
const MINUTOS_PARA_PAGAR = 30;
const MARGEN_CANCELACION_MIN = 5;

/**
 * ¿Es la primera compra de esta persona? Cuenta como "compra" cualquier pedido
 * que no esté CANCELADO. Así el descuento desaparece apenas se crea el pedido,
 * y si ese primer pedido se cancela, la persona recupera el descuento.
 */
async function esPrimeraCompra(usuarioId, db = pool) {
  const { rows } = await db.query(
    `SELECT 1 FROM pedidos WHERE usuario_id = $1 AND estado <> 'CANCELADO' LIMIT 1`,
    [usuarioId]
  );
  return rows.length === 0;
}

/** Para que el frontend sepa si debe mostrar el descuento en el carrito. */
async function consultarDescuentoBienvenida(usuarioId) {
  const disponible = await esPrimeraCompra(usuarioId);
  return { disponible, porcentaje: DESCUENTO_BIENVENIDA_PORCENTAJE };
}

/**
 * Crea un pedido y descuenta el stock de cada producto/talla comprado.
 * Todo ocurre dentro de una transacción SQL: si falta stock de cualquier
 * item, o algo falla, se revierte TODO el pedido (nada queda a medias).
 *
 * @param {Object} params
 * @param {string} params.usuarioId
 * @param {string} [params.direccionId]
 * @param {Array<{productoId: string, tallaId: string, cantidad: number}>} params.items
 * @param {string} params.metodoPago - EFECTIVO | TRANSFERENCIA | TARJETA
 *
 * El costo de envío NO se recibe: lo calcula el servidor (gratis desde ENVIO_GRATIS_DESDE).
 */
async function crearPedido({ usuarioId, direccionId, items, metodoPago }) {
  if (!items || items.length === 0) {
    throw new Error('El pedido debe tener al menos un producto');
  }
  if (!METODOS_PAGO.includes(metodoPago)) {
    throw new Error('Selecciona un método de pago válido (efectivo, transferencia o tarjeta)');
  }

  // Libera el stock de pedidos con tarjeta que nunca se pagaron. Si esto falla,
  // no debe impedir la compra.
  await cancelarPedidosTarjetaVencidos().catch((err) =>
    console.error('No se pudieron limpiar los pedidos vencidos:', err)
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloquea la fila del usuario mientras dura la transacción: así dos pedidos
    // simultáneos de la misma persona no pueden usar el descuento los dos.
    await client.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [usuarioId]);
    const aplicaDescuento = await esPrimeraCompra(usuarioId, client);

    let subtotal = 0;
    const detalles = [];

    for (const item of items) {
      // Precio actual del producto
      const { rows: productoRows } = await client.query(
        'SELECT * FROM productos WHERE id = $1 AND activo = true',
        [item.productoId]
      );
      const producto = productoRows[0];
      if (!producto) {
        throw new Error(`Producto ${item.productoId} no disponible`);
      }

      // Descuento ATÓMICO y condicional: solo baja el stock si hay
      // suficiente (WHERE stock >= cantidad). Si otra compra ya lo
      // agotó, no se actualiza ninguna fila y abortamos.
      const { rowCount } = await client.query(
        `UPDATE producto_tallas
         SET stock = stock - $1
         WHERE producto_id = $2 AND talla_id = $3 AND stock >= $1`,
        [item.cantidad, item.productoId, item.tallaId]
      );

      if (rowCount === 0) {
        throw new Error(
          `Stock insuficiente para el producto ${item.productoId} en la talla seleccionada`
        );
      }

      const precioUnitario = producto.precio;
      subtotal += Number(precioUnitario) * item.cantidad;

      detalles.push({
        productoId: item.productoId,
        tallaId: item.tallaId,
        cantidad: item.cantidad,
        precioUnitario, // "foto" del precio al momento de la compra
      });
    }

    // Descuento de bienvenida (solo primera compra), sobre el subtotal de productos
    const descuento = aplicaDescuento
      ? Math.round((subtotal * DESCUENTO_BIENVENIDA_PORCENTAJE) / 100)
      : 0;

    // Envío gratis si el subtotal de productos llega al umbral (se mide antes del descuento)
    const costoEnvioFinal = subtotal >= ENVIO_GRATIS_DESDE ? 0 : COSTO_ENVIO_ESTANDAR;
    const total = subtotal - descuento + costoEnvioFinal;

    const { rows: pedidoRows } = await client.query(
      `INSERT INTO pedidos (usuario_id, direccion_id, subtotal, descuento, costo_envio, total, metodo_pago, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDIENTE')
       RETURNING *`,
      [usuarioId, direccionId || null, subtotal, descuento, costoEnvioFinal, total, metodoPago]
    );
    const pedido = pedidoRows[0];

    for (const d of detalles) {
      await client.query(
        `INSERT INTO pedido_detalle (pedido_id, producto_id, talla_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4, $5)`,
        [pedido.id, d.productoId, d.tallaId, d.cantidad, d.precioUnitario]
      );
    }

    await client.query(
      `INSERT INTO historial_estado_pedido (pedido_id, estado, comentario)
       VALUES ($1, 'PENDIENTE', $2)`,
      [pedido.id, `Pedido creado — pago: ${ETIQUETA_METODO[metodoPago]}`]
    );

    await client.query('COMMIT');

    return { ...pedido, detalles };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Lista los pedidos de un usuario, con su detalle. */
async function listarPedidosUsuario(usuarioId) {
  const { rows: pedidos } = await pool.query(
    'SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY created_at DESC',
    [usuarioId]
  );

  const { rows: detalles } = await pool.query(
    `SELECT pd.*, p.nombre AS producto_nombre, t.nombre AS talla
     FROM pedido_detalle pd
     JOIN productos p ON p.id = pd.producto_id
     JOIN tallas t ON t.id = pd.talla_id
     WHERE pd.pedido_id = ANY($1::uuid[])`,
    [pedidos.map((p) => p.id)]
  );

  return pedidos.map((p) => ({
    ...p,
    detalles: detalles.filter((d) => d.pedido_id === p.id),
  }));
}

/**
 * Cambia el estado de un pedido y deja constancia en historial_estado_pedido.
 * Si el pedido pasa a CANCELADO, devuelve el stock reservado a producto_tallas.
 * Todo dentro de una transacción.
 *
 * @param {Object} params
 * @param {string} params.pedidoId
 * @param {string} params.nuevoEstado - uno de ESTADOS_VALIDOS
 * @param {string} [params.comentario]
 */
async function cambiarEstadoPedido({ pedidoId, nuevoEstado, comentario }) {
  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    throw new Error(`Estado inválido: ${nuevoEstado}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: pedidoRows } = await client.query(
      'SELECT * FROM pedidos WHERE id = $1 FOR UPDATE',
      [pedidoId]
    );
    const pedido = pedidoRows[0];
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    if (pedido.estado === 'CANCELADO' || pedido.estado === 'ENTREGADO') {
      throw new Error(`No se puede cambiar el estado de un pedido ${pedido.estado}`);
    }

    // Si se cancela, se devuelve el stock reservado
    if (nuevoEstado === 'CANCELADO') {
      const { rows: detalles } = await client.query(
        'SELECT producto_id, talla_id, cantidad FROM pedido_detalle WHERE pedido_id = $1',
        [pedidoId]
      );
      for (const d of detalles) {
        await client.query(
          `UPDATE producto_tallas
           SET stock = stock + $1
           WHERE producto_id = $2 AND talla_id = $3`,
          [d.cantidad, d.producto_id, d.talla_id]
        );
      }
    }

    const { rows: actualizadoRows } = await client.query(
      `UPDATE pedidos
       SET estado = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [nuevoEstado, pedidoId]
    );

    await client.query(
      `INSERT INTO historial_estado_pedido (pedido_id, estado, comentario)
       VALUES ($1, $2, $3)`,
      [pedidoId, nuevoEstado, comentario || null]
    );

    await client.query('COMMIT');

    return actualizadoRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancela (y devuelve el stock de) los pedidos con tarjeta que siguen PENDIENTES,
 * sin ningún pago asociado, y cuyo plazo para pagar ya venció.
 * Se ejecuta antes de cada pedido nuevo y cada 10 minutos (ver index.js).
 */
async function cancelarPedidosTarjetaVencidos() {
  const { rows } = await pool.query(
    `SELECT id FROM pedidos
     WHERE metodo_pago = 'TARJETA'
       AND estado = 'PENDIENTE'
       AND mp_pago_id IS NULL
       AND COALESCE(pago_expira_at, created_at + interval '1 minute' * $1::int)
           + interval '1 minute' * $2::int < now()`,
    [MINUTOS_PARA_PAGAR, MARGEN_CANCELACION_MIN]
  );

  for (const { id } of rows) {
    try {
      await cambiarEstadoPedido({
        pedidoId: id,
        nuevoEstado: 'CANCELADO',
        comentario: 'Pago con tarjeta no completado a tiempo',
      });
    } catch (err) {
      console.error(`No se pudo cancelar el pedido vencido ${id}:`, err.message);
    }
  }
  return rows.length;
}

module.exports = {
  crearPedido,
  listarPedidosUsuario,
  cambiarEstadoPedido,
  consultarDescuentoBienvenida,
  cancelarPedidosTarjetaVencidos,
  MINUTOS_PARA_PAGAR,
};