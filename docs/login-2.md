# Sistema de Login - Documentación Técnica Nivel SaaS

## 📋 Overview

Sistema de autenticación seguro implementado con React + TypeScript, optimizado para entorno SaaS multi-tenant en producción, siguiendo una arquitectura limpia y las mejores prácticas de seguridad enterprise.

## 🔐 Características de Seguridad Nivel Producción

- ✅ **Token en localStorage + cookies**: SIN variables globales window
- ✅ **Getter seguro para token**: Controlado desde AuthContext + localStorage
- ✅ **Session hydration**: Restauración automática al recargar
- ✅ **Control de refresh concurrente**: Evita múltiples requests simultáneas
- ✅ **HttpOnly cookies**: Refresh token manejo seguro (backend)
- ✅ **Axios interceptors avanzados**: Manejo automático con cola de requests
- ✅ **withCredentials**: Habilitado para cookies
- ✅ **Autorización automática**: Header Bearer token
- ✅ **Estado de sesión claro**: loading/authenticated/unauthenticated
- ✅ **Circular import elimination**: Arquitectura limpia sin dependencias cíclicas
- ✅ **Loop prevention**: Control de refresh infinito
- ✅ **Dual storage**: Cookies HttpOnly + localStorage fallback

## 🏗️ Arquitectura Mejorada

```
src/
├── pages/
│   └── LoginPage.tsx           # Contenedor principal
├── components/
│   ├── forms/
│   │   └── LoginForm.tsx        # Formulario con validación
│   ├── ui/
│   │   ├── Input.tsx           # Input reutilizable
│   │   ├── Button.tsx          # Botón con loading
│   │   └── ErrorMessage.tsx    # Mensajes de error
│   └── PrivateRoute.tsx        # Protección con loading state
├── services/
│   └── authService.ts          # Comunicación con backend
├── context/
│   └── AuthContext.tsx         # Estado global + session hydration
└── api/
    └── axiosInstance.ts        # Configuración + refresh concurrente
```

## 🔄 Flujo de Autenticación Mejorado

### 1. Session Hydration (App Start)
```
App Mount → AuthProvider → refreshToken() → 
  ✅ Success: status=authenticated + user data
  ❌ Failure: status=unauthenticated
```

### 2. Login Request
```
Usuario → LoginPage → AuthContext.login() → authService.login() → Backend
```

### 3. Response Handling
```
Backend → { accessToken, user } → AuthContext (guarda en memoria) → Navigate /dashboard
```

### 4. Concurrent Token Refresh
```
Multiple 401s → Single refresh() → Queue requests → 
  ✅ Success: Retry all with new token
  ❌ Failure: Global logout
```

### 5. Protected Routes con Loading
```
/user/ruta → PrivateRoute → 
  status="loading" → Spinner (no flicker)
  status="unauthenticated" → Redirect /login  
  status="authenticated" → Render children
```

## 📦 Dependencias

```json
{
  "axios": "^1.x.x",
  "react-hook-form": "^7.x.x",
  "@hookform/resolvers": "^3.x.x",
  "zod": "^3.x.x",
  "react-router-dom": "^6.x.x"
}
```

## 🔌 API Endpoints

### POST /auth/login
```json
Request: {
  "email": "string",
  "password": "string"
}

Response: {
  "accessToken": "string",
  "user": {
    "id": "string",
    "email": "string",
    "roles": ["string"],
    "tenant": "string"
  }
}
```

### POST /auth/refresh
```json
Request: {} (con HttpOnly cookie + withCredentials)
Response: {
  "accessToken": "string",
  "refreshToken": "string", // Para localStorage fallback
  "user": {
    "id": "string",
    "email": "string",
    "roles": ["string"],
    "tenant": "string"
  }
}
```

### POST /auth/logout
```json
Request: {} (con HttpOnly cookie)
Response: 200 OK
```

## 🎯 Componentes Detallados

### AuthContext.tsx (Mejorado)
- **Estado**: status, authUser, accessToken, tenant, roles, error
- **Tipos**: AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
- **Session Hydration**: useEffect con refreshToken() al montar
- **Getter Seguro**: getAccessToken() desde localStorage (SIN circular import)
- **Funciones**: login(), logout(), refreshToken(), clearError()
- **Token Storage**: Sincronización automática con localStorage
- **Cleanup**: Limpieza completa de tokens en logout

### axiosInstance.ts (Concurrent Refresh + Anti-Loop)
- **Control Concurrente**: isRefreshing flag + failedQueue
- **Request Interceptor**: getAccessToken() desde localStorage (sin circular import)
- **Response Interceptor**: 
  - 401 → Si refresh en progreso → encolar
  - 401 → Si no refresh → ejecutar + procesar cola
- **Queue Processing**: Reintentar todas las requests pendientes
- **Loop Prevention**: Solo un refresh activo a la vez
- **Cookie Support**: withCredentials para HttpOnly cookies
- **Fallback Strategy**: Cookies + localStorage dual storage

### PrivateRoute.tsx (Anti-Flicker)
- **Loading State**: Spinner mientras status="loading"
- **No Flicker**: Evita parpadeo visual al montar
- **Clear Logic**: loading → unauthenticated → authenticated

## 🏢 Multi-Tenant Consideraciones

### Separación de Responsabilidades
- **Frontend**: NO resuelve tenant
- **Backend**: Valida tenant en cada request
- **Tenant Suspended**: Backend retorna 403 → logout forzado
- **Tenant Change**: Invalida sesión actual

### Comportamiento Multi-Tenant
```typescript
// Si usuario intenta login con tenant distinto
if (currentTenant !== newTenant) {
  await logout(); // Limpiar estado previo
  await login(email, password); // Nueva sesión
}
```

## 🔒 Seguridad Mejorada

### 1. Token Management (localStorage + cookies)
```typescript
// ✅ CORRECTO: Getter seguro desde localStorage
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

// ✅ CORRECTO: Sincronización automática
export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
}

// ❌ INCORRECTO: NO usar variables globales
let currentToken = null; // Evitar variables globales
(window as any).__ACCESS_TOKEN__ = token; // VULNERABLE
```

### 2. Session Hydration
```typescript
// ✅ CORRECTO: Restauración automática
useEffect(() => {
  const hydrateSession = async () => {
    try {
      const response = await authService.refresh();
      dispatch({ type: 'SESSION_SUCCESS', payload: response });
    } catch {
      dispatch({ type: 'SESSION_FAILURE' });
    }
  };
  hydrateSession();
}, []);
```

### 3. Concurrent Refresh Control + Anti-Loop
```typescript
// ✅ CORRECTO: Un solo refresh activo
let isRefreshing = false;
let failedQueue: any[] = [];

if (error.response?.status === 401 && !originalRequest._retry) {
  if (isRefreshing) {
    // Encolar si ya hay refresh en progreso
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }
  
  originalRequest._retry = true;
  isRefreshing = true;
  
  try {
    // Ejecutar refresh una sola vez
    const response = await axios.post('/auth/refresh', {}, {
      withCredentials: true // Importante para cookies
    });
    
    // Procesar cola de peticiones pendientes
    processQueue(null, response.data.accessToken);
  } catch (refreshError) {
    // Si falla, limpiar todo y logout
    processQueue(refreshError, null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  } finally {
    isRefreshing = false;
  }
}
```

## 🧪 Testing Strategy Ampliada

### Unit Tests
- Componentes UI (Input, Button, ErrorMessage)
- Validación de formularios (zod schemas)
- Lógica de AuthContext (reducers, actions)
- Getter de token (getAccessToken)

### Integration Tests
- Flujo completo de login
- Session hydration automático
- Refresh token concurrente
- Protección de rutas con loading

### E2E Tests
- Login → Dashboard flow
- Token expiry + refresh automático
- Múltiples requests 401 concurrentes
- Logout y cleanup completo
- Tenant suspension scenarios

### Performance Tests
- Refresh concurrente bajo carga
- Session hydration performance
- Memory leaks (token cleanup)

## 🚀 Deploy Considerations Nivel Producción

### Environment Variables
```bash
VITE_API_URL=https://api.yourapp.com
```

### Security Headers OBLIGATORIOS
```
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: https://yourapp.com
```

### Token Configuration
- **AccessToken expiry**: 10-15 minutos
- **RefreshToken expiry**: 7-30 días
- **HTTPS**: OBLIGATORIO en producción
- **Secure cookies**: true en producción

### CORS Configuration
```javascript
{
  origin: 'https://yourapp.com',
  credentials: true,
  optionsSuccessStatus: 200
}
```

### Rate Limiting
- Login endpoint: 5 requests/minuto
- Refresh endpoint: 10 requests/minuto
- General: 100 requests/minuto por usuario

## 🐛 Troubleshooting Mejorado

### Common Issues

1. **Maximum update depth exceeded**
   - Causa: useEffect sin dependencias correctas
   - Solución: Revisar arrays de dependencias

2. **401 Unauthorized persistente**
   - Causa: Refresh token expirado o invalidado
   - Solución: Forzar logout y redirect a login

3. **Loop infinito de refresh**
   - Causa: Múltiples peticiones 401 sin control concurrente
   - Solución: Implementar isRefreshing flag + failedQueue

4. **Circular import en desarrollo**
   - Causa: axiosInstance importa getAccessToken de AuthContext
   - Solución: Usar localStorage directamente en interceptor

5. **Flicker en protected routes**
   - Causa: No manejar loading state
   - Solución: Implementar spinner en PrivateRoute

6. **Session not restoring**
   - Causa: Session hydration fallando
   - Solución: Verificar endpoint refresh y cookies

7. **Vite HMR errors**
   - Causa: Export incompatible en AuthContext
   - Solución: Eliminar variables globales y circular imports

8. **Multiple refresh requests**
   - Causa: Control concurrente no implementado
   - Solución: Verificar isRefreshing flag

### Debug Tools
```typescript
// Debug token state (solo desarrollo)
if (import.meta.env.DEV) {
  console.log('Token state:', { 
    hasToken: !!getAccessToken(),
    hasRefreshToken: !!getRefreshToken(),
    status: authState.status,
    isRefreshing
  });
}

// Debug interceptor state
console.log('Axios interceptor:', {
  isRefreshing,
  queueLength: failedQueue.length,
  hasCredentials: axiosInstance.defaults.withCredentials
});
```

## 🔄 Next Steps Enterprise

1. **Implementar 2FA/MFA**
2. **Añadir device fingerprinting**
3. **Implementar audit logs completos**
4. **Añadir rate limiting avanzado**
5. **Implementar biometric auth**
6. **Añadir SSO integration**
7. **Implementar RBAC granular**
8. **Añadir session analytics**

## 📚 Referencias Enterprise

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [Axios Interceptors Advanced](https://axios-http.com/docs/interceptors)

---

## 🎯 Resultado Esperado Nivel SaaS

El sistema implementado cumple con:

- ✅ **Sin variables globales**: Token en localStorage + cookies
- ✅ **Session hydration**: Restauración automática transparente
- ✅ **Refresh concurrente**: Control avanzado de múltiples requests
- ✅ **Anti-loop infinito**: Control estricto de refresh simultáneos
- ✅ **Rutas protegidas**: Sin flicker visual
- ✅ **Separación clara**: Responsabilidades bien definidas
- ✅ **Multi-tenant ready**: Arquitectura SaaS escalable
- ✅ **Producción segura**: Enterprise-grade security
- ✅ **TypeScript estricto**: Tipado completo y seguro
- ✅ **Circular import free**: Arquitectura limpia y mantenible
- ✅ **Vite HMR compatible**: Sin errores de hot reload
- ✅ **Dual storage**: Máxima compatibilidad cookies + localStorage
