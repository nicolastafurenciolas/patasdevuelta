/* Inyecta las etiquetas Open Graph de cada mascota para que, al pegar el
   enlace en WhatsApp o Instagram, aparezca la foto y el nombre.
   Necesita las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY
   configuradas en Netlify. Si faltan, la página funciona igual. */

export default async (peticion, contexto) => {
  const respuesta = await contexto.next();
  const tipo = respuesta.headers.get("content-type") || "";
  if (!tipo.includes("text/html")) return respuesta;

  const API = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!API || !KEY) return respuesta;

  const codigo = new URL(peticion.url).pathname.split("/m/")[1]?.split("/")[0];
  if (!codigo) return respuesta;

  let m;
  try {
    const r = await fetch(
      `${API.replace(/\/$/, "")}/rest/v1/mascotas_publicas?codigo=eq.${encodeURIComponent(codigo)}&limit=1`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    m = (await r.json())[0];
  } catch { return respuesta; }
  if (!m) return respuesta;

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const foto = (m.fotos && m.fotos[0]) || "";
  const nombre = m.nombre || `${m.especie} sin identificar`;
  const rotulo = m.estado === "resuelto"
    ? `${nombre} ya está en casa`
    : m.tipo === "perdida" ? `SE BUSCA: ${nombre}` : `ENCONTRADA: ${nombre}`;

  const zona = [m.lugar, m.municipio, m.departamento].filter(Boolean).join(", ");
  const detalle = [
    m.estado === "resuelto" ? "Este caso ya se resolvió." : null,
    [m.especie, m.tamano].filter(Boolean).join(", "),
    zona ? `Zona: ${zona}` : null,
    m.rasgos
  ].filter(Boolean).join(" · ").slice(0, 190);

  const meta = `
<title>${esc(rotulo)} — Patas de vuelta</title>
<meta name="description" content="${esc(detalle)}">
<meta property="og:title" content="${esc(rotulo)}">
<meta property="og:description" content="${esc(detalle)}">
<meta property="og:image" content="${esc(foto)}">
<meta property="og:url" content="${esc(peticion.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(foto)}">`;

  const html = (await respuesta.text())
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta property="og:(title|description)"[^>]*>/g, "")
    .replace(/<meta name="twitter:card"[^>]*>/g, "")
    .replace("</head>", meta + "\n</head>");

  return new Response(html, {
    status: respuesta.status,
    headers: { ...Object.fromEntries(respuesta.headers), "content-type": "text/html; charset=utf-8" }
  });
};
