const jwt = require('jsonwebtoken');

/**
 * Verifica el token JWT enviado en el header Authorization: Bearer <token>
 * y adjunta el usuario decodificado en req.usuario.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Debe usarse DESPUÉS de requireAuth. Bloquea el acceso si el usuario
 * autenticado no tiene rol ADMIN.
 */
function requireAdmin(req, res, next) {
  if (req.usuario?.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };