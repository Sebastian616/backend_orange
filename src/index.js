require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const direccionRoutes = require('./routes/direccionRoutes');
const favoritoRoutes = require('./routes/favoritoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const productoRoutes = require('./routes/productoRoutes');
const productoTallaRoutes = require('./routes/productoTallaRoutes');
const resenaRoutes = require('./routes/resenaRoutes');
const tallaRoutes = require('./routes/tallaRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();

// 1. Configuración de CORS Totalmente Permisiva para depuración
app.use(cors({
  origin: '*', // Permite cualquier origen de forma explícita
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*'],
  credentials: false // Requerido si origin es '*'
}));

// 2. Responder 200 OK a TODAS las peticiones OPTIONS inmediatamente
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  return res.sendStatus(200);
});

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/categorias', categoriaRoutes);
app.use('/direcciones', direccionRoutes);
app.use('/favoritos', favoritoRoutes);
app.use('/pedidos', pedidoRoutes);
app.use('/productos', productoRoutes);
app.use('/', productoTallaRoutes);
app.use('/', resenaRoutes);
app.use('/tallas', tallaRoutes);
app.use('/usuarios', usuarioRoutes);

// 404 para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

// Manejador de errores genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API corriendo en el puerto ${PORT}`);
});