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

// Lista de orígenes permitidos (sitio web desplegado + entorno local)
const origenesPermitidos = [
  'https://www.stororange.lat',
  'https://stororange.lat',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Si la petición no tiene origen (ej: Postman, cURL) o si el origen está en la lista blanca
    if (!origin || origenesPermitidos.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // O cambiar por callback(new Error('No permitido por CORS')) para mayor rigidez
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Private-Network']
}));

// Permite peticiones de Red Privada (público HTTPS -> local HTTP)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  
  // Responde inmediatamente a las solicitudes de verificación OPTIONS
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
});

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/categorias', categoriaRoutes);
app.use('/direcciones', direccionRoutes);
app.use('/favoritos', favoritoRoutes);
app.use('/pedidos', pedidoRoutes);
app.use('/productos', productoRoutes);
app.use('/', productoTallaRoutes); // /productos/:id/tallas
app.use('/', resenaRoutes);        // /productos/:id/resenas y /resenas/:id
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
  console.log(`API corriendo en http://localhost:${PORT}`);
});