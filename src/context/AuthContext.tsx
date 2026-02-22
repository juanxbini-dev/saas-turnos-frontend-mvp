import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { authService } from '../services/authService';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface User {
  id: string;
  email: string;
  nombre: string;
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
  localStorage.setItem('accessToken', accessToken);
  
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
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
    
    if (token && refreshToken) {
      const hydrateSession = async () => {
        try {
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
        } catch (error) {
          clearTokens();
          dispatch({ type: 'SESSION_FAILURE' });
        }
      };

      hydrateSession();
    } else {
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
      
      setTokens(response.accessToken, response.refreshToken);
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
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
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
      
      setTokens(response.accessToken, response.refreshToken);
    } catch (error) {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
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
