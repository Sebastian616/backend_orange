const { Router } = require('express');
const {
  registrar,
  login,
  reenviarVerificacion,
  verificarCorreo,
  olvidePassword,
  resetearPassword,
} = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = Router();

router.post('/registro', registrar);
router.post('/login', login);

router.post('/reenviar-verificacion', requireAuth, reenviarVerificacion);
router.get('/verificar-correo/:token', verificarCorreo);

router.post('/olvide-password', olvidePassword);
router.post('/resetear-password', resetearPassword);

module.exports = router;