import { TipoCampania } from '../../types/campania.types';

export interface InfoCampania {
  comoFunciona: string;
  comoElige: string[];
  quedaAfuera: string[];
  nota?: string;
}

// Espejo en palabras de los selectores del backend
// (backend/src/application/use-cases/campanias/selectores). Si cambia el criterio, cambiar acá.
export const INFO_CAMPANIAS: Record<TipoCampania, InfoCampania> = {
  recencia: {
    comoFunciona:
      'Compara hace cuántos días que el cliente no viene contra cada cuánto suele venir. Cuando llega a su ciclo, le escribe.',
    comoElige: [
      '"Cada cuánto suele venir" se resuelve en este orden: primero la frecuencia recomendada cargada en la ficha de su servicio habitual (el que más se hizo en los últimos 12 meses); si ese campo está vacío, la mediana de los intervalos entre sus propias visitas, con un mínimo de 3 visitas.',
      'Se usa la mediana y no el promedio: así una visita muy espaciada no le corre el ciclo hacia adelante.',
      'Entra el día que alcanza esa frecuencia y sigue siendo candidato durante los días de "ventana de aviso". Pasada la ventana ya no recibe este mensaje.',
    ],
    quedaAfuera: [
      'Clientes que ya tienen un turno agendado a futuro.',
      'Clientes sin frecuencia calculable: servicio habitual sin frecuencia cargada y menos de 3 visitas propias.',
      'Recibe un solo mensaje por ciclo, aunque el sistema evalúe todos los días.',
    ],
  },
  winback: {
    comoFunciona: 'Busca clientes que se fueron hace rato y ya pasaron largamente su ciclo habitual.',
    comoElige: [
      'Entra cuando pasaron más días que el umbral configurado acá Y más del doble de su frecuencia habitual: se toma el mayor de los dos.',
      'Si al cliente no se le puede calcular la frecuencia, alcanza con el umbral configurado.',
      'Recibe como máximo la cantidad de intentos configurada en toda su historia, separados por los días entre intentos.',
    ],
    quedaAfuera: [
      'Clientes que ya tienen un turno agendado a futuro.',
      'Clientes que agotaron los intentos: no se los vuelve a contactar por esta campaña.',
      'Recencia y win-back comparten el "no repetir antes de": quien recibió una no recibe la otra durante ese período.',
    ],
  },
  post_servicio: {
    comoFunciona: 'Agradece y pide reseña después de un turno cobrado.',
    comoElige: [
      'Turnos cobrados hace entre las horas configuradas y unos 3 días. Ese margen evita perder turnos si el sistema no corre algún día.',
      'Un mensaje por turno.',
    ],
    quedaAfuera: [
      'Turnos que nunca se cobraron, aunque el cliente haya venido: el disparador es el cobro, no la asistencia.',
    ],
  },
  seguimiento_producto: {
    comoFunciona: 'Pregunta cómo le está resultando un producto que compró, según el tag del producto.',
    comoElige: [
      'Ventas de productos que tengan alguno de los tags configurados acá. Los tags se cargan por producto en la pantalla de Productos.',
      'Se cuenta desde la fecha de la venta: entra cuando pasaron los días de la regla, y hasta 3 días después.',
      'Si el producto cae en varias reglas, gana la de menos días.',
      'Un mensaje por venta.',
    ],
    quedaAfuera: [
      'Ventas sin cliente asignado.',
      'Productos que no tengan ninguno de los tags configurados.',
      'Si no hay ninguna regla cargada, esta campaña no le escribe a nadie.',
    ],
  },
  reposicion_producto: {
    comoFunciona: 'Avisa cuando el producto que compró se le debe estar por acabar.',
    comoElige: [
      'Necesita que el producto tenga cargada la "duración estimada" en la pantalla de Productos. Sin ese dato, ese producto nunca dispara el aviso.',
      'La fecha de aviso es: fecha de compra + duración estimada − los días de "avisar antes". Entra ese día y hasta 7 días después.',
      'Un mensaje por venta.',
    ],
    quedaAfuera: [
      'Clientes que ya volvieron a comprar el mismo producto después de esa compra.',
      'Ventas sin cliente asignado.',
    ],
  },
  turno_abandonado: {
    comoFunciona: 'Recontacta por un turno concreto que quedó sin cerrar. Cubre dos casos distintos.',
    comoElige: [
      'Pendiente sin confirmar: el turno se creó hace más de las horas configuradas y su fecha todavía no pasó.',
      'Cancelado sin reagendar: se canceló hace más de los días configurados, el cliente no volvió a sacar turno, y la cancelación no tiene más de 30 días.',
      'En el caso de los cancelados, además, el cliente no puede tener ningún turno futuro.',
    ],
    quedaAfuera: [
      'Turnos pendientes cuya fecha ya pasó: pedir que confirmen algo que ya ocurrió no tiene sentido.',
      'Cancelaciones de más de 30 días.',
      'Si el cliente tiene varios turnos en esta situación, recibe uno solo.',
    ],
    nota: 'Es la única campaña que no cede ante un turno próximo, porque justamente habla de un turno.',
  },
};

// Filtros globales del motor (EjecutarCampaniasUseCase.evaluarFiltros): valen para las 6 campañas.
export const REGLAS_GENERALES: string[] = [
  'Solo se le escribe a clientes activos, con teléfono cargado y que aceptaron recibir mensajes. Quien responde BAJA deja de recibir campañas.',
  'Como máximo 1 mensaje automático por cliente por día, sea de la campaña que sea.',
  'Si el cliente tiene un turno hoy o mañana, o acaba de recibir la confirmación de uno, el mensaje de marketing espera: los mensajes del turno son prioridad. La excepción es Turno abandonado.',
  'Cada disparador se usa una sola vez: el mismo turno, la misma venta o el mismo ciclo no generan dos mensajes.',
  'Un cliente que hoy queda afuera por estas reglas vuelve a competir en la corrida del día siguiente.',
];
