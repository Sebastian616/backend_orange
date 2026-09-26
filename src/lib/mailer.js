// lib/mailer.js

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'recuperacion@stororange.lat';

let resend = null;
if (RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(RESEND_API_KEY);
}

// Limpia la URL base y se asegura de remover diagonales al final
const rawFrontendUrl = process.env.FRONTEND_URL ;
const BASE_URL = rawFrontendUrl.trim().replace(/\/+$/, '');

async function enviarCorreo({ to, subject, html }) {
  if (!resend) {
    console.log('--- Correo (modo desarrollo, sin RESEND_API_KEY) ---');
    console.log('Para:', to);
    console.log('Asunto:', subject);
    console.log(html);
    console.log('----------------------------------------------------');
    return { dev: true };
  }

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('Error desde la API de Resend:', error);
    throw new Error(`Error enviando correo: ${error.message}`);
  }

  return data;
}

function enviarCorreoVerificacion(correo, token) {
  const link = `${BASE_URL}/#/verificar-correo?token=${token}`;
  return enviarCorreo({
    to: correo,
    subject: 'Verifica tu correo',
    html: `
      <p>Haz clic en el siguiente enlace para verificar tu correo:</p>
      <p><a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a></p>
    `,
  });
}

function enviarCorreoResetPassword(correo, token) {
  // Aseguramos que el token no tenga espacios ni caracteres no válidos para una URL
  const tokenClean = encodeURIComponent(token.trim());
  const link = `${BASE_URL}/#/resetear-password?token=${tokenClean}`;

  return enviarCorreo({
    to: correo,
    subject: 'Recupera tu contraseña',
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
        <h2>Recuperación de contraseña</h2>
        <p>Haz clic en el siguiente botón para elegir una nueva contraseña (el enlace expira en 1 hora):</p>
        <p style="margin: 20px 0;">
          <a href="${link}" target="_blank" style="background-color: #8B4513; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Restablecer contraseña
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">
          Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
          <a href="${link}" target="_blank">${link}</a>
        </p>
      </div>
    `,
  });
}

module.exports = { enviarCorreo, enviarCorreoVerificacion, enviarCorreoResetPassword };