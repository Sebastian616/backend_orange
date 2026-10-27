// services/pagoService.js — cobro con tarjeta mediante Mercado Pago (Checkout Pro)
const crypto = require('crypto');
const pool = require('../lib/db');
const mp = require('../lib/mercadopago');
const { MINUTOS_PARA_PAGAR } = require('./pedidoService');

class ErrorPago extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

// URL pública del backend
const BACKEND_URL = (
  process.env.BACKEND_URL || 'https://backend-orange.onrender.com'
).trim().replace(/\/+$/, '');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mercado Pago pide las fechas con zona horaria. Colombia es UTC-5 todo el año (sin horario de verano).
function aIsoColombia(fecha) {
  const desplazada = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
  return desplazada.toISOString().replace('Z', '-05:00');
}

/**
 * Crea la preferencia de pago en Mercado Pago para un pedido con tarjeta que sigue
 * PENDIENTE y devuelve la URL (initPoint) a la que hay que enviar a la persona.
 */
async function iniciarPagoConTarjeta(pedidoId, usuarioId) {
  if (!mp.habilitado) {
    throw new ErrorPago('El pago con tarjeta no está disponible por ahora. Elige otro método de pago.', 503);
  }
  if (!UUID.test(String(pedidoId))) throw new ErrorPago('Pedido no encontrado', 404);

  const { rows } = await pool.query(
    `SELECT p.*, u.nombre AS usuario_nombre, u.correo AS usuario_correo
     FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.id = $1`,
    [pedidoId]
  );
  const pedido = rows[0];

  if (!pedido || pedido.usuario_id !== usuarioId) throw new ErrorPago('Pedido no encontrado', 404);
  if (pedido.metodo_pago !== 'TARJETA') throw new ErrorPago('Este pedido no es de pago con tarjeta', 400);
  if (pedido.estado !== 'PENDIENTE' || pedido.mp_pago_id) {
    throw new ErrorPago('Este pedido ya no está pendiente de pago', 409);
  }

  const ahora = new Date();
  const expira = new Date(ahora.getTime() + MINUTOS_PARA_PAGAR * 60 * 1000);

  // Aseguramos que los datos del usuario no tengan espacios y estén limpios
  const correoLimpio = String(pedido.usuario_correo || '').trim().toLowerCase();
  const nombreLimpio = String(pedido.usuario_nombre || '').trim();

  const cuerpo = {
    items: [
      {
        id: String(pedido.id),
        title: `Pedido Orange Store #${pedido.id.slice(0, 8)}`,
        quantity: 1,
        currency_id: 'COP',
        unit_price: Number(pedido.total),
      },
    ],
    payer: {
      name: nombreLimpio,
      email: correoLimpio,
    },
    external_reference: String(pedido.id),
    back_urls: {
      success: `${BACKEND_URL}/pagos/retorno/exito`,
      failure: `${BACKEND_URL}/pagos/retorno/fallo`,
      pending: `${BACKEND_URL}/pagos/retorno/pendiente`,
    },
    auto_return: 'approved',
    statement_descriptor: 'ORANGE STORE',
    expires: true,
    expiration_date_from: aIsoColombia(ahora),
    expiration_date_to: aIsoColombia(expira),
  };

  // Mercado Pago solo puede avisar a una URL pública con https
  if (BACKEND_URL.startsWith('https://')) {
    cuerpo.notification_url = `${BACKEND_URL}/pagos/webhook`;
  }

  const preferencia = await mp.preference.create({ body: cuerpo });

  await pool.query(
    `UPDATE pedidos SET pago_expira_at = now() + interval '1 minute' * $1::int WHERE id = $2`,
    [MINUTOS_PARA_PAGAR, pedido.id]
  );

  return { initPoint: preferencia.init_point, preferenceId: preferencia.id };
}

/**
 * Procesa un pago de Mercado Pago (llamado desde el webhook y desde la página de retorno).
 */
async function procesarPago(paymentId) {
  if (!mp.habilitado) throw new Error('Mercado Pago no está configurado');

  const pago = await mp.payment.get({ id: paymentId });
  const pedidoId = pago.external_reference;
  if (!pedidoId || !UUID.test(String(pedidoId))) return { ignorado: 'sin referencia de pedido' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [pedidoId]);
    const pedido = rows[0];

    let resultado;

    if (!pedido || pedido.metodo_pago !== 'TARJETA') {
      resultado = { ignorado: 'el pedido no existe o no es de pago con tarjeta' };
    } else if (pago.status !== 'approved') {
      resultado = { estadoPago: pago.status };
    } else if (pago.currency_id !== 'COP' || Number(pago.transaction_amount) !== Number(pedido.total)) {
      await client.query(
        `INSERT INTO historial_estado_pedido (pedido_id, estado, comentario) VALUES ($1, $2, $3)`,
        [
          pedido.id,
          pedido.estado,
          `ATENCIÓN: el pago ${pago.id} llegó aprobado pero con un monto distinto al del pedido ` +
            `(${pago.transaction_amount} ${pago.currency_id} vs ${pedido.total} COP). No se confirmó automáticamente.`,
        ]
      );
      console.error(`Pago ${pago.id}: monto no coincide con el pedido ${pedido.id}`);
      resultado = { ignorado: 'el monto no coincide' };
    } else if (pedido.mp_pago_id && String(pedido.mp_pago_id) === String(pago.id)) {
      resultado = { yaProcesado: true };
    } else if (pedido.estado === 'PENDIENTE') {
      await client.query(
        `UPDATE pedidos SET estado = 'CONFIRMADO', mp_pago_id = $1, pagado_at = now(), updated_at = now()
         WHERE id = $2`,
        [String(pago.id), pedido.id]
      );
      await client.query(
        `INSERT INTO historial_estado_pedido (pedido_id, estado, comentario) VALUES ($1, 'CONFIRMADO', $2)`,
        [pedido.id, `Pago aprobado con Mercado Pago (id ${pago.id})`]
      );
      resultado = { confirmado: true };
    } else if (pedido.estado === 'CANCELADO') {
      await client.query(
        `UPDATE pedidos SET mp_pago_id = $1, pagado_at = now(), updated_at = now() WHERE id = $2`,
        [String(pago.id), pedido.id]
      );
      await client.query(
        `INSERT INTO historial_estado_pedido (pedido_id, estado, comentario) VALUES ($1, 'CANCELADO', $2)`,
        [
          pedido.id,
          `ATENCIÓN: llegó un pago aprobado (id ${pago.id}) después de cancelar el pedido. Hay que reembolsarlo desde Mercado Pago.`,
        ]
      );
      console.error(`Pago ${pago.id} aprobado para el pedido cancelado ${pedido.id}: requiere reembolso`);
      resultado = { requiereReembolso: true };
    } else {
      await client.query(
        `UPDATE pedidos SET mp_pago_id = COALESCE(mp_pago_id, $1), pagado_at = COALESCE(pagado_at, now()) WHERE id = $2`,
        [String(pago.id), pedido.id]
      );
      resultado = { yaProcesado: true };
    }

    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Valida la firma (x-signature) de un webhook de Mercado Pago.
 */
function firmaValida({ xSignature, xRequestId, dataId }) {
  const secreto = (process.env.MP_WEBHOOK_SECRET || '').trim();
  if (!secreto || !xSignature) return true;

  let ts = null;
  let v1 = null;
  for (const parte of String(xSignature).split(',')) {
    const [clave, valor] = parte.trim().split('=');
    if (clave === 'ts') ts = valor;
    else if (clave === 'v1') v1 = valor;
  }
  if (!ts || !v1) return false;

  const partes = [];
  if (dataId) partes.push(`id:${String(dataId).toLowerCase()}`);
  if (xRequestId) partes.push(`request-id:${xRequestId}`);
  partes.push(`ts:${ts}`);
  const manifiesto = `${partes.join(';')};`;

  const esperado = Buffer.from(crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex'));
  const recibido = Buffer.from(v1);
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
}

module.exports = { ErrorPago, iniciarPagoConTarjeta, procesarPago, firmaValida, UUID };