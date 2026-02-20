export type UsuarioRol = 'admin' | 'staff';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  username: string;
  empresa_id: string;
  roles: UsuarioRol[];
  activo: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUsuarioData {
  nombre: string;
  username: string;
  password: string;
  email: string;
  rol: UsuarioRol;
}

export interface UpdateDatosData {
  nombre: string;
  username: string;
}

export interface UpdatePasswordData {
  passwordActual: string;
  passwordNueva: string;
  passwordNuevaRepetir: string;
}
