const { Router } = require('express');
const {
  listarPorProducto,
  asignarTalla,
  actualizarStock,
  quitarTalla,
} = require('../controllers/productoTallaController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = Router();

router.get('/productos/:productoId/tallas', listarPorProducto);
router.post('/productos/:productoId/tallas', requireAuth, requireAdmin, asignarTalla);
router.put('/productos/:productoId/tallas/:tallaId', requireAuth, requireAdmin, actualizarStock);
router.delete('/productos/:productoId/tallas/:tallaId', requireAuth, requireAdmin, quitarTalla);

module.exports = router;