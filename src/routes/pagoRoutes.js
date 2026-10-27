const { Router } = require('express');
const { webhook, retorno, iniciar } = require('../controllers/pagoController');
const { requireAuth } = require('../middlewares/auth');

const router = Router();

// Públicas: las llaman Mercado Pago y el navegador al volver del pago
router.post('/webhook', webhook);
router.get('/retorno/:resultado', retorno);

// Protegida: reintentar el pago con tarjeta de un pedido propio
router.post('/pedido/:pedidoId/iniciar', requireAuth, iniciar);

module.exports = router;