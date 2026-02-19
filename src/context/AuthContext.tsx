import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { authService } from '../services/authService';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface User {
  id: string;
  email: string;
  roles: string[];
  tenant: string;
}

interface AuthState {
  status: AuthStatus;
  authUser: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tenant: string | null;
  roles: string[];
  error: string | null;
}

type AuthAction =
  | { type: 'SESSION_LOADING' }
  | { type: 'SESSION_SUCCESS'; payload: { user: User; accessToken: string; refreshToken?: string } }
  | { type: 'SESSION_FAILURE' }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string; refreshToken: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_SUCCESS'; payload: { accessToken: string; refreshToken?: string } }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  status: 'unauthenticated',  // Evitar loop de hydration
  authUser: null,
  accessToken: null,
  refreshToken: null,
  tenant: null,
  roles: [],
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SESSION_LOADING':
      return { ...state, status: 'loading', error: null };
    case 'SESSION_SUCCESS':
      return {
        ...state,
        status: 'authenticated',
        authUser: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken || null,
        tenant: action.payload.user.tenant,
        roles: action.payload.user.roles,
        error: null,
      };
    case 'SESSION_FAILURE':
      return {
        ...state,
        status: 'unauthenticated',
        authUser: null,
        accessToken: null,
        refreshToken: null,
        tenant: null,
        roles: [],
        error: null,
      };
    case 'LOGIN_START':
      return { ...state, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        status: 'authenticated',
        authUser: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        tenant: action.payload.user.tenant,
        roles: action.payload.user.roles,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        status: 'unauthenticated',
        authUser: null,
        accessToken: null,
        refreshToken: null,
        tenant: null,
        roles: [],
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        status: 'unauthenticated',
      };
    case 'REFRESH_SUCCESS':
      return {
        ...state,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken || state.refreshToken,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Funciones para acceder a tokens desde localStorage
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

// Funciones para guardar tokens
export function setTokens(accessToken: string, refreshToken?: string): void {
  console.log('🔍 [Debug] setTokens llamado con:', {
    accessToken: accessToken ? 'presente' : 'ausente',
    refreshToken: refreshToken ? 'presente' : 'ausente'
  });
  
  localStorage.setItem('accessToken', accessToken);
  console.log('🔍 [Debug] Access token guardado en localStorage');
  
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
    console.log('🔍 [Debug] Refresh token guardado en localStorage');
  } else {
    console.log('⚠️ [Debug] Refresh token es undefined/null, no se guarda');
  }
  
  // Verificación final
  console.log('🔍 [Debug] Estado final localStorage:', {
    access: localStorage.getItem('accessToken'),
    refresh: localStorage.getItem('refreshToken')
  });
}

// Función para limpiar tokens
export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Sincronizar estado con localStorage al montar
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    console.log('🔍 [Auth] Verificando sesión al montar...');
    console.log('📱 [Auth] Token encontrado:', !!token);
    console.log('🔄 [Auth] Refresh token encontrado:', !!refreshToken);
    console.log('🔍 [Debug] Estado localStorage completo:', {
      access: token,
      refresh: refreshToken,
      accessLength: token?.length,
      refreshLength: refreshToken?.length
    });
    
    if (token && refreshToken) {
      // Intentar refrescar la sesión para validar el token
      const hydrateSession = async () => {
        try {
          console.log('🔄 [Auth] Hidratando sesión...');
          dispatch({ type: 'SESSION_LOADING' });
          const response = await authService.refresh();
          
          dispatch({
            type: 'SESSION_SUCCESS',
            payload: {
              user: response.user,
              accessToken: response.accessToken,
              refreshToken: response.refreshToken
            },
          });
          
          console.log('✅ [Auth] Sesión hidratada exitosamente');
          console.log('👤 [Auth] Usuario:', response.user.email);
          console.log('🕐 [Auth] Access token válido por 15 minutos');
        } catch (error) {
          console.log('❌ [Auth] Error hidratando sesión, limpiando tokens...');
          clearTokens();
          dispatch({ type: 'SESSION_FAILURE' });
        }
      };

      hydrateSession();
    } else {
      console.log('🚫 [Auth] No hay tokens, usuario no autenticado');
      dispatch({ type: 'SESSION_FAILURE' });
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'LOGIN_START' });
      const response = await authService.login(email, password);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken
        },
      });
      
      console.log('🔍 [Auth] Login response completo:', response);
      console.log('🔍 [Auth] Refresh token en response:', response.refreshToken);
      
      // Guardar tokens en localStorage
      console.log('🔍 [Debug] Antes de guardar tokens:', {
        access: localStorage.getItem('accessToken'),
        refresh: localStorage.getItem('refreshToken')
      });
      
      setTokens(response.accessToken, response.refreshToken);
      
      console.log('🔍 [Debug] Después de guardar tokens:', {
        access: localStorage.getItem('accessToken'),
        refresh: localStorage.getItem('refreshToken')
      });
      
      console.log('✅ [Auth] Login exitoso');
      console.log('👤 [Auth] Usuario:', response.user.email);
      console.log('🏢 [Auth] Tenant:', response.user.tenant);
      console.log('🔐 [Auth] Access token generado (15 min de validez)');
      console.log('🔄 [Auth] Refresh token generado (7 días de validez)');
      
      // Calcular tiempo de expiración
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000);
      console.log('⏰ [Auth] Primer refresh automático:', expirationTime.toLocaleTimeString());
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Error al iniciar sesión';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
      console.log('🚪 [Auth] Sesión cerrada, tokens eliminados');
    }
  };

  const refreshToken = async () => {
    try {
      const response = await authService.refresh();
      
      dispatch({
        type: 'REFRESH_SUCCESS',
        payload: {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken
        },
      });
      
      // Actualizar tokens en localStorage
      setTokens(response.accessToken, response.refreshToken);
      
      console.log('✅ [Auth] Refresh manual exitoso');
      console.log('🔐 [Auth] Nuevo access token (15 min de validez)');
      
      // Calcular tiempo de expiración
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000);
      console.log('⏰ [Auth] Próximo refresh automático:', expirationTime.toLocaleTimeString());
    } catch (error) {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
      console.log('❌ [Auth] Error en refresh manual, cerrando sesión...');
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        logout,
        refreshToken,
        clearError,
        getAccessToken,
        getRefreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
