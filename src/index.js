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

app.use(cors());
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

// Manejador de errores genérico (por si algo se escapa de los try/catch)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});