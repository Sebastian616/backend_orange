// lib/mailer.js

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'recuperacion@stororange.lat';

let resend = null;
if (RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(RESEND_API_KEY);
}

// Limpia el frontend URL para evitar dobles // en el enlace
const BASE_URL = (process.env.FRONTEND_URL || 'https://www.stororange.lat').replace(/\/+$/, '');

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
    html: `<p>Haz clic para verificar tu correo:</p><p><a href="${link}">${link}</a></p>`,
  });
}

function enviarCorreoResetPassword(correo, token) {
  const link = `${BASE_URL}/#/resetear-password?token=${token}`;
  return enviarCorreo({
    to: correo,
    subject: 'Recupera tu contraseña',
    html: `<p>Haz clic para elegir una nueva contraseña (el link expira en 1 hora):</p><p><a href="${link}">${link}</a></p>`,
  });
}

module.exports = { enviarCorreo, enviarCorreoVerificacion, enviarCorreoResetPassword };