// ============================================================
//  AVISO POR CORREO CUANDO ALGUIEN DEJA INFORMACIÓN
//
//  Es OPCIONAL. Si no la instalas, la página funciona igual:
//  quien encontró al animal ya obtiene el contacto directo al
//  instante, y quien publicó ve las novedades al entrar.
//  Esto solo acorta el tiempo cuando nadie está mirando.
//
//  Instalación: ver el README, sección "Avisos por correo".
// ============================================================

const RESEND = Deno.env.get("RESEND_API_KEY");
const REMITENTE = Deno.env.get("CORREO_REMITENTE") || "avisos@resend.dev";
const SITIO = Deno.env.get("SITIO_URL") || "https://patasdevuelta.netlify.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

Deno.serve(async (peticion) => {
  try {
    if (!RESEND || !SERVICE_KEY) {
      return new Response("Falta configuración (RESEND_API_KEY o service role)", { status: 200 });
    }

    // El webhook de Supabase manda { type, table, record, old_record }
    const cuerpo = await peticion.json();
    const pista = cuerpo.record;
    if (!pista || !pista.mascota_id) return new Response("sin pista", { status: 200 });

    // Buscamos a quién avisar (con la clave de servicio, que sí puede leer la tabla)
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/mascotas?id=eq.${pista.mascota_id}&select=codigo,nombre,especie,tipo,contacto_email,contacto_nombre,token_gestion`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    const m = (await r.json())[0];
    if (!m || !m.contacto_email) return new Response("sin correo registrado", { status: 200 });

    const quien = m.nombre || (m.tipo === "perdida" ? "tu mascota" : "la mascota que encontraste");
    const tieneAnimal = pista.clase === "tengo";
    const asunto = tieneAnimal
      ? `Alguien dice tener a ${quien}`
      : `Nueva información sobre ${quien}`;

    const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;
            background:#F4F2E9;padding:28px 24px;color:#12211C">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#4A5A53;margin:0 0 6px">
    Patas de vuelta</p>
  <h1 style="font-size:24px;line-height:1.2;margin:0 0 16px">${esc(asunto)}</h1>

  ${tieneAnimal ? `<p style="background:#E3F1E8;border-left:4px solid #15704B;padding:12px 14px;
      margin:0 0 16px;font-size:15px"><strong>Esta persona dice tener al animal con ella.</strong></p>` : ""}

  <p style="font-size:16px;line-height:1.5;margin:0 0 8px">Alguien dejó este mensaje:</p>
  <blockquote style="border-left:3px solid #D9D5C4;margin:0 0 18px;padding:4px 0 4px 14px;
      font-size:16px;line-height:1.5">${esc(pista.mensaje)}</blockquote>

  ${pista.lugar ? `<p style="font-size:15px;margin:0 0 8px"><strong>Dónde:</strong> ${esc(pista.lugar)}</p>` : ""}
  ${pista.contacto ? `<p style="font-size:15px;margin:0 0 18px"><strong>Su contacto:</strong> ${esc(pista.contacto)}</p>`
        : `<p style="font-size:15px;margin:0 0 18px;color:#4A5A53">No dejó número de contacto.</p>`}

  <p style="margin:0 0 22px">
    <a href="${SITIO}/g/${m.token_gestion}"
       style="display:inline-block;background:#12211C;color:#F4F2E9;text-decoration:none;
              padding:13px 22px;border-radius:10px;font-weight:600;font-size:16px">
      Ver la publicación</a></p>

  <p style="font-size:13px;color:#4A5A53;line-height:1.5;margin:0;border-top:1px solid #D9D5C4;padding-top:14px">
    Nadie que de verdad tenga a tu mascota te va a pedir dinero por adelantado.
    Antes de entregarla o de ir a recogerla, pide que te describan la seña que dejaste privada.</p>
</div>`;

    const envio = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Patas de vuelta <${REMITENTE}>`,
        to: [m.contacto_email],
        subject: asunto,
        html
      })
    });

    return new Response(envio.ok ? "enviado" : "error al enviar: " + await envio.text(), { status: 200 });
  } catch (e) {
    // Nunca fallamos ruidosamente: un aviso perdido no debe romper el registro de la pista.
    return new Response("error: " + e.message, { status: 200 });
  }
});
