const { Router } = require('express');
const { listarMias, crear, actualizar, eliminar } = require('../controllers/direccionController');
const { requireAuth } = require('../middlewares/auth');

const router = Router();

// Todas requieren estar autenticado (son datos privados del usuario)
router.get('/', requireAuth, listarMias);
router.post('/', requireAuth, crear);
router.put('/:id', requireAuth, actualizar);
router.delete('/:id', requireAuth, eliminar);

module.exports = router;