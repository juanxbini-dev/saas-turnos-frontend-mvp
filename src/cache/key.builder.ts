export const ENTITIES = {
  PRODUCTS: 'products',
  USER: 'user',
  REPORTS: 'reports',
  ORDERS: 'orders',
  CATEGORIES: 'categories',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  PROFILE: 'profile',
  USUARIOS: 'usuarios',
  SERVICIOS: 'servicios',
  MIS_SERVICIOS: 'mis-servicios',
  CLIENTES: 'clientes'
} as const;

function decodeJWT(token: string): any | null {
  try {
    // JWT tiene formato header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Decodificar payload (base64)
    const payload = atob(parts[1]);
    const decoded = JSON.parse(payload);
    
    return decoded;
  } catch (error) {
    return null;
  }
}

function getCurrentTenant(): string {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return 'global';
    }
    
    const decoded = decodeJWT(token);
    
    // Buscar tenant en varios campos posibles
    const tenant = decoded?.empresaId || decoded?.tenant || decoded?.tenantId || decoded?.organization || decoded?.company;
    
    return tenant || 'global';
  } catch (error) {
    return 'global';
  }
}

export function buildKey(entity: string, ...parts: string[]): string {
  const tenant = getCurrentTenant();
  const allParts = [tenant, entity, ...parts];
  return allParts.join(':');
}
