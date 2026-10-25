import { describe, it, expect } from 'vitest';
import { textoMail } from '../../components/campanias/listaVieja/ListaViejaHistorial';

// beneficio-con-turno §5.4 y D9: las plantillas nuevas del historial en lenguaje llano
describe('textoMail (historial de la lista vieja)', () => {
  it.each([
    ['lista_vieja', 'Primer mail'],
    ['lista_vieja_recordatorio', 'Recordatorio'],
    ['lista_vieja_clic_sin_turno', 'Recordatorio (tocó y no reservó)'],
    ['lista_vieja_ultimo_dia', 'Último día'],
  ])('%s → %s', (plantilla, texto) => {
    expect(textoMail(plantilla)).toBe(texto);
  });
});
