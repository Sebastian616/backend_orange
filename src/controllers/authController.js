const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../lib/db');
const { enviarCorreoVerificacion, enviarCorreoResetPassword } = require('../lib/mailer');

const SALT_ROUNDS = 10;
const EXPIRACION_TOKEN_MS = 60 * 60 * 1000; // 1 hora

async function registrar(req, res) {
  const { nombre, correo, whatsapp, password } = req.body;

  if (!nombre || !correo || !whatsapp || !password) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const existente = await pool.query(
      'SELECT id FROM usuarios WHERE correo = $1',
      [correo]
    );
    if (existente.rows.length > 0) {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, correo, whatsapp, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, correo, whatsapp, rol, created_at`,
      [nombre, correo, whatsapp, passwordHash]
    );

    const usuario = rows[0];
    const token = generarToken(usuario);

    // Dispara la verificación de correo sin bloquear la respuesta del registro
    enviarTokenVerificacion(usuario.id, correo).catch((err) =>
      console.error('Error al enviar correo de verificación', err)
    );

    res.status(201).json({ usuario, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
}

async function login(req, res) {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE correo = $1',
      [correo]
    );
    const usuario = rows[0];

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generarToken(usuario);

    res.json({
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        whatsapp: usuario.whatsapp,
        rol: usuario.rol,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

// POST /auth/reenviar-verificacion — requiere auth
async function reenviarVerificacion(req, res) {
  const usuarioId = req.usuario.id;

  try {
    const { rows } = await pool.query(
      'SELECT correo, correo_verificado FROM usuarios WHERE id = $1',
      [usuarioId]
    );
    const usuario = rows[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (usuario.correo_verificado) {
      return res.status(400).json({ error: 'El correo ya está verificado' });
    }

    await enviarTokenVerificacion(usuarioId, usuario.correo);
    res.json({ mensaje: 'Correo de verificación reenviado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reenviar la verificación' });
  }
}

// GET /auth/verificar-correo/:token — público
async function verificarCorreo(req, res) {
  const { token } = req.params;
  const tokenHash = hashToken(token);

  try {
    const { rows } = await pool.query(
      `SELECT id FROM usuarios
       WHERE token_verificacion = $1 AND token_verificacion_expira > now()`,
      [tokenHash]
    );
    const usuario = rows[0];
    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    await pool.query(
      `UPDATE usuarios
       SET correo_verificado = true, token_verificacion = NULL, token_verificacion_expira = NULL
       WHERE id = $1`,
      [usuario.id]
    );

    res.json({ mensaje: 'Correo verificado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar el correo' });
  }
}

// POST /auth/olvide-password — público. body: { correo }
async function olvidePassword(req, res) {
  const { correo } = req.body;

  if (!correo) {
    return res.status(400).json({ error: 'El correo es requerido' });
  }

  try {
    const { rows } = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
    const usuario = rows[0];

    // Responde igual exista o no el correo, para no revelar qué correos están registrados
    if (usuario) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const expira = new Date(Date.now() + EXPIRACION_TOKEN_MS);

      await pool.query(
        `UPDATE usuarios
         SET token_reset_password = $1, token_reset_password_expira = $2
         WHERE id = $3`,
        [tokenHash, expira, usuario.id]
      );

      await enviarCorreoResetPassword(correo, token);
    }

    res.json({ mensaje: 'Si el correo existe, se envió un enlace para recuperar la contraseña' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}

// POST /auth/resetear-password — público. body: { token, password }
async function resetearPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'token y password son requeridos' });
  }

  try {
    const tokenHash = hashToken(token);
    const { rows } = await pool.query(
      `SELECT id FROM usuarios
       WHERE token_reset_password = $1 AND token_reset_password_expira > now()`,
      [tokenHash]
    );
    const usuario = rows[0];
    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query(
      `UPDATE usuarios
       SET password_hash = $1, token_reset_password = NULL, token_reset_password_expira = NULL
       WHERE id = $2`,
      [passwordHash, usuario.id]
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
}

// --- helpers internos ---

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function enviarTokenVerificacion(usuarioId, correo) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expira = new Date(Date.now() + EXPIRACION_TOKEN_MS);

  await pool.query(
    `UPDATE usuarios
     SET token_verificacion = $1, token_verificacion_expira = $2
     WHERE id = $3`,
    [tokenHash, expira, usuarioId]
  );

  await enviarCorreoVerificacion(correo, token);
}

module.exports = {
  registrar,
  login,
  reenviarVerificacion,
  verificarCorreo,
  olvidePassword,
  resetearPassword,
};