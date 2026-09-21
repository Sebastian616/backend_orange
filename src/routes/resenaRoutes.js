const express = require('express');
const router = express.Router();

const {
  listarPorProducto,
  resumenPorProducto,
  crear,
  actualizar,
  eliminar,
} = require('../controllers/resenaController');
const { requireAuth } = require('../middlewares/auth');

// Rutas públicas: cualquiera puede ver reseñas de un producto
router.get('/productos/:productoId/resenas', listarPorProducto);
router.get('/productos/:productoId/resenas/resumen', resumenPorProducto);

// Rutas protegidas: solo usuarios autenticados
router.post('/productos/:productoId/resenas', requireAuth, crear);
router.put('/resenas/:id', requireAuth, actualizar);
router.delete('/resenas/:id', requireAuth, eliminar);

module.exports = router;