const { Router } = require('express');
const { listar, crear, actualizar, eliminar } = require('../controllers/categoriaController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = Router();

router.get('/', listar);
router.post('/', requireAuth, requireAdmin, crear);
router.put('/:id', requireAuth, requireAdmin, actualizar);
router.delete('/:id', requireAuth, requireAdmin, eliminar);

module.exports = router;