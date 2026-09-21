const { Router } = require('express');
const {
  obtenerPerfil,
  actualizarPerfil,
  listar,
  cambiarRol,
} = require('../controllers/usuarioController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = Router();

router.get('/me', requireAuth, obtenerPerfil);
router.put('/me', requireAuth, actualizarPerfil);

router.get('/', requireAuth, requireAdmin, listar);
router.patch('/:id/rol', requireAuth, requireAdmin, cambiarRol);

module.exports = router;