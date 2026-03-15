export interface Horario {
  dia: string;
  apertura: string;
  cierre: string;
}

export interface LandingConfig {
  id: string;
  empresa_id: string;
  titulo: string | null;
  descripcion: string | null;
  logo_url: string | null;
  logo_public_id: string | null;
  fondo_url: string | null;
  fondo_public_id: string | null;
  direccion: string | null;
  horarios: Horario[];
  created_at: string;
  updated_at: string;
}

export interface LandingProfesional {
  id: string;
  empresa_id: string;
  usuario_id: string;
  nombre: string;
  username: string;
  avatar_url: string | null;
  descripcion: string | null;
  orden: number;
  visible: boolean;
  enLanding: boolean;
}

export interface LandingPublicaData {
  config: LandingConfig;
  profesionales: LandingProfesional[];
}
