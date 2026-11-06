import type { FichaDuplicado, ParDuplicado } from '../../types/clienteDuplicados.types';

// Agrupa los pares por persona. Solo las coincidencias fuertes o a corroborar unen fichas:
// si A con B y B con C están en la lista, A, B y C son una persona.
// Un contacto compartido (mismo teléfono, nombres distintos) NO une: puede ser familia o dos personas
// que usan la misma línea. Esos pares quedan como tarjetas aparte, sin botón de unificar.
export interface GrupoDuplicados {
  id: string;
  fichas: FichaDuplicado[];
  pares: ParDuplicado[];
  /** true si el grupo es solo un contacto compartido: no se puede unificar desde acá */
  soloContactoCompartido: boolean;
}

export function agruparPares(pares: ParDuplicado[]): GrupoDuplicados[] {
  const padre = new Map<string, string>();
  const raiz = (id: string): string => {
    let actual = id;
    while (padre.get(actual) !== actual) actual = padre.get(actual)!;
    padre.set(id, actual);
    return actual;
  };
  const unir = (x: string, y: string) => {
    const rx = raiz(x);
    const ry = raiz(y);
    if (rx !== ry) padre.set(rx, ry);
  };
  const uneta = (par: ParDuplicado) => par.categoria !== 'contacto_compartido';

  for (const par of pares) {
    for (const id of [par.a.id, par.b.id]) if (!padre.has(id)) padre.set(id, id);
  }
  for (const par of pares) if (uneta(par)) unir(par.a.id, par.b.id);

  const grupos = new Map<string, GrupoDuplicados>();
  const agregar = (clave: string, par: ParDuplicado, solo: boolean) => {
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = { id: clave, fichas: [], pares: [], soloContactoCompartido: solo };
      grupos.set(clave, grupo);
    }
    grupo.pares.push(par);
    for (const ficha of [par.a, par.b]) {
      if (!grupo.fichas.some((f) => f.id === ficha.id)) grupo.fichas.push(ficha);
    }
    if (!solo) grupo.soloContactoCompartido = false;
  };

  for (const par of pares) {
    if (uneta(par)) {
      agregar(raiz(par.a.id), par, false);
    } else if (raiz(par.a.id) === raiz(par.b.id)) {
      // Contacto compartido entre fichas que ya son la misma persona por otro par: va con su grupo
      agregar(raiz(par.a.id), par, false);
    } else {
      // Contacto compartido entre dos personas: tarjeta aparte
      const [x, y] = [par.a.id, par.b.id].sort();
      agregar(`compartido:${x}|${y}`, par, true);
    }
  }

  return [...grupos.values()].map((g) => ({
    ...g,
    fichas: [...g.fichas].sort((x, y) => y.turnos - x.turnos || (x.nombre ?? '').localeCompare(y.nombre ?? '')),
  }));
}

/** ¿Hay un par visible entre estas dos fichas? El servidor solo une fichas que coinciden directamente. */
export function hayParEntre(grupo: GrupoDuplicados, idA: string, idB: string): boolean {
  return grupo.pares.some((p) => (p.a.id === idA && p.b.id === idB) || (p.a.id === idB && p.b.id === idA));
}

/** Letra de cada ficha dentro del grupo (A, B, C…). Va en la tarjeta, en las coincidencias y en el modal. */
export function letraDe(grupo: GrupoDuplicados, fichaId: string): string {
  const i = grupo.fichas.findIndex((f) => f.id === fichaId);
  return i >= 0 ? String.fromCharCode(65 + i) : '?';
}

const RANGO_CATEGORIA: Record<ParDuplicado['categoria'], number> = { fuerte: 0, a_corroborar: 1, contacto_compartido: 2 };

/** Categoría más fuerte que tiene el grupo: fuerte antes que a corroborar, y así */
export function categoriaDelGrupo(grupo: GrupoDuplicados): ParDuplicado['categoria'] {
  return grupo.pares.reduce<ParDuplicado['categoria']>(
    (mejor, p) => (RANGO_CATEGORIA[p.categoria] < RANGO_CATEGORIA[mejor] ? p.categoria : mejor),
    grupo.pares[0].categoria
  );
}

export type OrdenGrupos = 'categoria' | 'nombre' | 'turnos';

/** Ordena las tarjetas: primero las más fuertes, o por nombre, o por cantidad de turnos */
export function ordenarGrupos(grupos: GrupoDuplicados[], orden: OrdenGrupos): GrupoDuplicados[] {
  const nombre = (g: GrupoDuplicados) => (g.fichas[0].nombre ?? '').toLowerCase();
  const turnos = (g: GrupoDuplicados) => g.fichas.reduce((n, f) => n + f.turnos, 0);
  return [...grupos].sort((x, y) => {
    if (orden === 'nombre') return nombre(x).localeCompare(nombre(y));
    if (orden === 'turnos') return turnos(y) - turnos(x);
    return RANGO_CATEGORIA[categoriaDelGrupo(x)] - RANGO_CATEGORIA[categoriaDelGrupo(y)] || nombre(x).localeCompare(nombre(y));
  });
}

/** Busca por nombre, teléfono o mail de cualquiera de las fichas del grupo */
export function coincideBusqueda(grupo: GrupoDuplicados, texto: string): boolean {
  const q = texto.trim().toLowerCase();
  if (!q) return true;
  const digitos = q.replace(/\D/g, '');
  return grupo.fichas.some((f) => {
    const campos = [f.nombre ?? '', f.email ?? ''].map((c) => c.toLowerCase());
    const tel = (f.telefono ?? '').replace(/\D/g, '');
    return campos.some((c) => c.includes(q)) || (digitos.length >= 4 && tel.includes(digitos));
  });
}

/** Clave estable del grupo, para recordar la selección de cada tarjeta */
export function claveGrupo(grupo: GrupoDuplicados): string {
  return grupo.fichas.map((f) => f.id).sort().join('|');
}

/** Fichas que el servidor puede unir con esta principal (tienen un par directo con ella) */
export function elegiblesCon(grupo: GrupoDuplicados, principalId: string): string[] {
  return grupo.fichas.filter((f) => f.id !== principalId && hayParEntre(grupo, principalId, f.id)).map((f) => f.id);
}
