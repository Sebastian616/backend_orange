// lib/mercadopago.js
// Cliente de Mercado Pago. Si no hay MP_ACCESS_TOKEN, el pago con tarjeta queda
// deshabilitado (efectivo y transferencia siguen funcionando igual).
const accessToken = (process.env.MP_ACCESS_TOKEN || '').trim();

let preference = null;
let payment = null;

if (accessToken) {
  const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
  preference = new Preference(client);
  payment = new Payment(client);
} else {
  console.warn('MP_ACCESS_TOKEN no está configurado: el pago con tarjeta está deshabilitado.');
}

module.exports = { habilitado: Boolean(accessToken), preference, payment };