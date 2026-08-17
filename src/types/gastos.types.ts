// Tipos de la sección de gastos (super admin).
// Diseño: backend/docs/gastos-superadmin.md

export interface GastosAccesoResponse {
  token: string;
  expires_in: number;
}

// Por qué el gate no dejó pasar. 'no_configurado' es un problema de la instalación
// (falta GASTOS_PASSWORD_HASH en el backend), no un error del usuario.
export type GastosAccesoError = 'password_incorrecta' | 'demasiados_intentos' | 'no_configurado' | 'error';

export interface GastosAccesoFallo {
  tipo: GastosAccesoError;
  mensaje: string;
  segundosRestantes?: number;
}
