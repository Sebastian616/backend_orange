// lib/mailer.js
//
// Envío de correos con Resend (https://resend.com). Requiere:
//   npm install resend
//   RESEND_API_KEY en tu .env
//   FRONTEND_URL en tu .env (ej: http://localhost:5173) para armar los links
//
// Mientras no tengas la API key configurada, este archivo solo imprime
// el correo en consola — así puedes probar los flujos sin depender de
// un servicio externo todavía.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

let resend = null;
if (RESEND_API_KEY) {
  const { Resend } = require('resend');
  resend = new Resend(RESEND_API_KEY);
}

async function enviarCorreo({ to, subject, html }) {
  if (!resend) {
    console.log('--- Correo (modo desarrollo, sin RESEND_API_KEY) ---');
    console.log('Para:', to);
    console.log('Asunto:', subject);
    console.log(html);
    console.log('----------------------------------------------------');
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
}

function enviarCorreoVerificacion(correo, token) {
  const link = `${process.env.FRONTEND_URL}/verificar-correo?token=${token}`;
  return enviarCorreo({
    to: correo,
    subject: 'Verifica tu correo',
    html: `<p>Haz clic para verificar tu correo:</p><p><a href="${link}">${link}</a></p>`,
  });
}

function enviarCorreoResetPassword(correo, token) {
  const link = `${process.env.FRONTEND_URL}/resetear-password?token=${token}`;
  return enviarCorreo({
    to: correo,
    subject: 'Recupera tu contraseña',
    html: `<p>Haz clic para elegir una nueva contraseña (el link expira en 1 hora):</p><p><a href="${link}">${link}</a></p>`,
  });
}

module.exports = { enviarCorreo, enviarCorreoVerificacion, enviarCorreoResetPassword };