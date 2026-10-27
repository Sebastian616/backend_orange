const { Router } = require('express');
const {
  crear,
  listarMios,
  descuentoBienvenida,
  listarTodos,
  obtenerPorId,
  cambiarEstado,
  obtenerHistorial,
} = require('../controllers/pedidoController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = Router();

router.post('/', requireAuth, crear);
router.get('/', requireAuth, listarMios);

// IMPORTANTE: también va ANTES de '/:id'
router.get('/descuento-bienvenida', requireAuth, descuentoBienvenida);

// IMPORTANTE: esta ruta debe ir ANTES de '/:id', si no Express interpreta
// "admin" como si fuera el :id
router.get('/admin/todos', requireAuth, requireAdmin, listarTodos);

router.get('/:id', requireAuth, obtenerPorId);
router.get('/:id/historial', requireAuth, obtenerHistorial);
router.patch('/:id/estado', requireAuth, requireAdmin, cambiarEstado);

module.exports = router;