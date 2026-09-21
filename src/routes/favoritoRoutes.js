const { Router } = require('express');
const { listarMios, agregar, quitar } = require('../controllers/favoritoController');
const { requireAuth } = require('../middlewares/auth');

const router = Router();

router.get('/', requireAuth, listarMios);
router.post('/', requireAuth, agregar);
router.delete('/:productoId', requireAuth, quitar);

module.exports = router;