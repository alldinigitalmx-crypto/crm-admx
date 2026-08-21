// Links de contacto directo (mailto / WhatsApp) reutilizados en la ficha
// del cliente y donde se necesite un acceso rápido a su correo o teléfono.

export function mailtoHref(email: string, asunto?: string, cuerpo?: string) {
  const params = new URLSearchParams();
  if (asunto) params.set("subject", asunto);
  if (cuerpo) params.set("body", cuerpo);
  const qs = params.toString();
  return `mailto:${email}${qs ? `?${qs}` : ""}`;
}

/** wa.me solo acepta dígitos (sin +, espacios ni guiones) — se asume que el
 * teléfono ya incluye código de país, tal como se captura en el formulario
 * de cliente (placeholder "+52 55 0000 0000"). */
export function whatsappHref(telefono: string, mensaje?: string) {
  const digitos = telefono.replace(/\D/g, "");
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${digitos}${texto}`;
}

export function mensajeAgendarCita(nombreCliente?: string) {
  const saludo = nombreCliente ? `¡Hola ${nombreCliente}!` : "¡Hola!";
  return (
    `${saludo} 👋 Soy Antonio de ADMX. Te dejo el link para que puedas agendar ` +
    `una reunión por Google Meet conmigo. Solo elige el día y hora que mejor ` +
    `te funcione: 📅 https://calendar.app.google/ihPYf2HPemQC1BCF8`
  );
}
