const { Router } = require('express');
const {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  reactivar,
  listarAdmin,
} = require('../controllers/productoController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = Router();

router.get('/', listar);

// IMPORTANTE: debe ir ANTES de '/:id', si no Express interpreta
// "admin" como si fuera el :id
router.get('/admin/todos', requireAuth, requireAdmin, listarAdmin);

router.get('/:id', obtener);
router.post('/', requireAuth, requireAdmin, crear);
router.put('/:id', requireAuth, requireAdmin, actualizar);
router.delete('/:id', requireAuth, requireAdmin, eliminar);
router.patch('/:id/reactivar', requireAuth, requireAdmin, reactivar);

module.exports = router;