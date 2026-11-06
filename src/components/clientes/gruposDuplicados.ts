import type { FichaDuplicado, ParDuplicado } from '../../types/clienteDuplicados.types';

// Criterio de agrupación (spec: backend/docs/clientes-unificar-spec.md, "Clasificación de los pares"):
// - No se encadena. Una tarjeta es un conjunto de fichas en el que TODAS coinciden con todas.
//   Si A coincide con B y B con C, pero A y C no coinciden, son dos tarjetas (A-B y B-C), no una persona de tres.
// - Solo cuentan para unir los pares "unibles": ni contacto compartido ni pares marcados como personas
//   distintas o contacto compartido. Un contacto compartido nunca une: queda en una tarjeta aparte, sin unificar.
// - Ninguna ficha se une por cadena: cada unión sale de un par directo que Dani confirma.
export interface GrupoDuplicados {
  id: string;
  fichas: FichaDuplicado[];
  pares: ParDuplicado[];
  /** true si el grupo es un par que no se puede unir desde la tarjeta (contacto compartido o par separado) */
  sinUnir: boolean;
  /** Claves "idA|idB" de las parejas de fichas del grupo que coinciden directamente y se pueden unir */
  directos: string[];
}

const RANGO_CATEGORIA: Record<ParDuplicado['categoria'], number> = { fuerte: 0, a_corroborar: 1, contacto_compartido: 2 };

const clavePar = (x: string, y: string): string => (x < y ? `${x}|${y}` : `${y}|${x}`);

/** Par que puede unirse: no es contacto compartido y no se marcó como personas distintas ni contacto compartido */
export function esUnible(par: ParDuplicado): boolean {
  return par.categoria !== 'contacto_compartido' && (par.decision === 'pendiente' || par.decision === 'misma_persona');
}

export function agruparPares(pares: ParDuplicado[]): GrupoDuplicados[] {
  const fichaPorId = new Map<string, FichaDuplicado>();
  for (const par of pares) {
    fichaPorId.set(par.a.id, par.a);
    fichaPorId.set(par.b.id, par.b);
  }

  const unibles = pares.filter(esUnible);
  const directos = new Set(unibles.map((p) => clavePar(p.a.id, p.b.id)));
  const coinciden = (x: string, y: string) => directos.has(clavePar(x, y));

  // Las coincidencias fuertes arman primero las tarjetas; el orden de ids deja el resultado estable
  const ordenados = [...unibles].sort(
    (p, q) => RANGO_CATEGORIA[p.categoria] - RANGO_CATEGORIA[q.categoria] || clavePar(p.a.id, p.b.id).localeCompare(clavePar(q.a.id, q.b.id))
  );

  interface Tarjeta { miembros: Set<string>; pares: ParDuplicado[] }
  const tarjetas: Tarjeta[] = [];
  // Una ficha entra a una tarjeta solo si coincide directamente con todas las que ya están
  const todasCoinciden = (t: Tarjeta, id: string) => [...t.miembros].every((m) => coinciden(m, id));

  for (const par of ordenados) {
    const x = par.a.id;
    const y = par.b.id;
    const conAmbas = tarjetas.find((t) => t.miembros.has(x) && t.miembros.has(y));
    if (conAmbas) {
      conAmbas.pares.push(par);
      continue;
    }
    const conX = tarjetas.find((t) => t.miembros.has(x) && todasCoinciden(t, y));
    if (conX) {
      conX.miembros.add(y);
      conX.pares.push(par);
      continue;
    }
    const conY = tarjetas.find((t) => t.miembros.has(y) && todasCoinciden(t, x));
    if (conY) {
      conY.miembros.add(x);
      conY.pares.push(par);
      continue;
    }
    tarjetas.push({ miembros: new Set([x, y]), pares: [par] });
  }

  const armar = (ids: string[], paresDelGrupo: ParDuplicado[], sinUnir: boolean): GrupoDuplicados => {
    const fichas = ids
      .map((id) => fichaPorId.get(id)!)
      .sort((x, y) => y.turnos - x.turnos || (x.nombre ?? '').localeCompare(y.nombre ?? ''));
    const directosDelGrupo: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (coinciden(ids[i], ids[j])) directosDelGrupo.push(clavePar(ids[i], ids[j]));
      }
    }
    return {
      id: [...ids].sort().join('|'),
      fichas,
      pares: paresDelGrupo,
      sinUnir,
      directos: directosDelGrupo,
    };
  };

  const grupos = tarjetas.map((t) => armar([...t.miembros], t.pares, false));
  // Contacto compartido y pares separados: tarjeta aparte, sin botón de unificar
  for (const par of pares) {
    if (!esUnible(par)) grupos.push(armar([par.a.id, par.b.id], [par], true));
  }
  return grupos;
}

/** ¿Hay una coincidencia directa que se pueda unir entre estas dos fichas de la tarjeta? */
export function hayParEntre(grupo: GrupoDuplicados, idA: string, idB: string): boolean {
  return grupo.directos.includes(clavePar(idA, idB));
}

/** Letra de cada ficha dentro del grupo (A, B, C…). Va en la tarjeta, en las coincidencias y en el modal. */
export function letraDe(grupo: GrupoDuplicados, fichaId: string): string {
  const i = grupo.fichas.findIndex((f) => f.id === fichaId);
  return i >= 0 ? String.fromCharCode(65 + i) : '?';
}

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

/** Fichas que se pueden unir con esta principal (tienen una coincidencia directa y unible con ella) */
export function elegiblesCon(grupo: GrupoDuplicados, principalId: string): string[] {
  return grupo.fichas.filter((f) => f.id !== principalId && hayParEntre(grupo, principalId, f.id)).map((f) => f.id);
}
