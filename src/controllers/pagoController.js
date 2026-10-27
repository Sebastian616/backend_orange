const { ErrorPago, iniciarPagoConTarjeta, procesarPago, firmaValida, UUID } = require('../services/pagoService');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');

// POST /pagos/webhook — lo llama Mercado Pago (sin autenticación de usuario).
// Siempre responde rápido; si algo falla de nuestro lado responde 500 para que Mercado Pago reintente.
async function webhook(req, res) {
  try {
    const tipo = req.query.type || req.body?.type;
    const dataId = req.query['data.id'] || req.body?.data?.id;

    if (!firmaValida({ xSignature: req.headers['x-signature'], xRequestId: req.headers['x-request-id'], dataId })) {
      return res.sendStatus(401);
    }

    // Solo interesan los pagos; cualquier otro evento se confirma y se ignora
    if (tipo !== 'payment' || !/^\d+$/.test(String(dataId || ''))) {
      return res.sendStatus(200);
    }

    await procesarPago(dataId);
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook de Mercado Pago:', err);
    res.sendStatus(500);
  }
}

// GET /pagos/retorno/:resultado — a donde Mercado Pago devuelve a la persona tras pagar.
// Confirma el pago por si el webhook aún no llegó (o no puede llegar, como en local) y la
// manda a la página de resultado del frontend.
async function retorno(req, res) {
  const resultado = ['exito', 'fallo', 'pendiente'].includes(req.params.resultado)
    ? req.params.resultado
    : 'pendiente';

  const pagoId = req.query.payment_id || req.query.collection_id;
  if (pagoId && /^\d+$/.test(String(pagoId))) {
    try {
      await procesarPago(pagoId);
    } catch (err) {
      console.error('No se pudo confirmar el pago al volver de Mercado Pago:', err);
    }
  }

  const referencia = String(req.query.external_reference || '');
  const pedido = UUID.test(referencia) ? `pedido=${encodeURIComponent(referencia)}&` : '';
  res.redirect(302, `${FRONTEND_URL}/#/pago/resultado?${pedido}resultado=${resultado}`);
}

// POST /pagos/pedido/:pedidoId/iniciar — (re)inicia el pago con tarjeta de un pedido pendiente
async function iniciar(req, res) {
  try {
    res.json(await iniciarPagoConTarjeta(req.params.pedidoId, req.usuario.id));
  } catch (err) {
    if (err instanceof ErrorPago) return res.status(err.status).json({ error: err.message });
    console.error('No se pudo iniciar el pago con tarjeta:', err);
    res.status(502).json({ error: 'No pudimos iniciar el pago con tarjeta. Intenta de nuevo.' });
  }
}

module.exports = { webhook, retorno, iniciar };