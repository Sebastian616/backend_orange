const { Router } = require('express');
const { listar, crear } = require('../controllers/tallaController');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = Router();

router.get('/', listar);
router.post('/', requireAuth, requireAdmin, crear);

module.exports = router;