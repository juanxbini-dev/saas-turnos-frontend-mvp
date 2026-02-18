import React, { createContext, useContext, useReducer, ReactNode } from 'react';
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
  tenant: string | null;
  roles: string[];
  error: string | null;
}

type AuthAction =
  | { type: 'SESSION_LOADING' }
  | { type: 'SESSION_SUCCESS'; payload: { user: User; accessToken: string } }
  | { type: 'SESSION_FAILURE' }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_SUCCESS'; payload: { accessToken: string } }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  status: 'loading',
  authUser: null,
  accessToken: null,
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
}

const AuthContext = createContext<AuthContextType | null>(null);

// Getter seguro para el token - NO expone el token globalmente
let currentToken: string | null = null;

export function getAccessToken(): string | null {
  return currentToken;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Actualizar token local cuando cambia en el estado
  React.useEffect(() => {
    currentToken = state.accessToken;
  }, [state.accessToken]);

  // Session hydration al montar el componente
  React.useEffect(() => {
    const hydrateSession = async () => {
      try {
        dispatch({ type: 'SESSION_LOADING' });
        const response = await authService.refresh();
        
        dispatch({
          type: 'SESSION_SUCCESS',
          payload: {
            user: response.user,
            accessToken: response.accessToken,
          },
        });
      } catch (error) {
        dispatch({ type: 'SESSION_FAILURE' });
      }
    };

    hydrateSession();
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
        },
      });
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
      currentToken = null;
      dispatch({ type: 'LOGOUT' });
    }
  };

  const refreshToken = async () => {
    try {
      const response = await authService.refresh();
      dispatch({
        type: 'REFRESH_SUCCESS',
        payload: { accessToken: response.accessToken },
      });
    } catch (error) {
      currentToken = null;
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
        getAccessToken: () => currentToken,
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
