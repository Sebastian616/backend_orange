const { Router } = require('express');
const {
  crear,
  listarMios,
  listarTodos,
  descuentoBienvenida,
  obtenerPorId,
  cambiarEstado,
  obtenerHistorial,
} = require('../controllers/pedidoController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = Router();

router.post('/', requireAuth, crear);
router.get('/', requireAuth, listarMios);

// Rutas estáticas ANTES de la ruta dinámica '/:id'
router.get('/admin/todos', requireAuth, requireAdmin, listarTodos);
router.get('/descuento-bienvenida', requireAuth, descuentoBienvenida);

// Rutas dinámicas
router.get('/:id', requireAuth, obtenerPorId);
router.get('/:id/historial', requireAuth, obtenerHistorial);
router.patch('/:id/estado', requireAuth, requireAdmin, cambiarEstado);

module.exports = router;