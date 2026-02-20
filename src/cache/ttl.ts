export const TTL = {
  // 1 minuto - Datos operativos en tiempo real
  // Usar para: estados de pedidos, notificaciones, datos que cambian constantemente
  SHORT: 60 * 1000,
  
  // 5 minutos - Perfil de usuario y datos de sesión
  // Usar para: información del usuario, preferencias, datos de configuración
  MEDIUM: 5 * 60 * 1000,
  
  // 30 minutos - Catálogos y reportes
  // Usar para: listas de productos, catálogos, reportes generales, datos relativamente estáticos
  LONG: 30 * 60 * 1000,
  
  // 0 - Sin caché
  // Usar para: datos que siempre deben ser frescos o cuando se quiere deshabilitar el caché explícitamente
  NONE: 0
} as const;
