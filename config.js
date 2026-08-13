// ============================================================
//  LO ÚNICO QUE TIENES QUE EDITAR PARA QUE LA PÁGINA FUNCIONE
//  Copia estos dos valores desde Supabase → Project Settings → API
// ============================================================

window.CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU_ANON_KEY_AQUI",

  // Ciudades que aparecen en los formularios. Cámbialas si amplías el alcance.
  CIUDADES: [
    "Manizales", "Pereira", "Dosquebradas", "Armenia",
    "Villamaría", "Chinchiná", "Santa Rosa de Cabal", "Cali", "Otra"
  ],

  // Se usa en los enlaces del afiche. Déjalo vacío y toma el dominio actual.
  DOMINIO: ""
};
