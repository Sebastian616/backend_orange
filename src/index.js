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

// Lista de orígenes permitidos
const origenesPermitidos = [
  'https://www.stororange.lat',
  'https://stororange.lat',
  'http://localhost:5173',
  'http://localhost:3000'
];

const opcionesCors = {
  origin: function (origin, callback) {
    if (!origin || origenesPermitidos.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por la política de CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Private-Network'],
  optionsSuccessStatus: 204
};

// 1. Aplicar la configuración de CORS globalmente
app.use(cors(opcionesCors));

// 2. Manejar de forma nativa con la librería cors todas las peticiones OPTIONS (Preflight)
app.options('*', cors(opcionesCors));

// 3. Encabezados adicionales si requiere soporte de red privada
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
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
  console.log(`API corriendo en el puerto ${PORT}`);
});