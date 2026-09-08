import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { Button, Input, Spinner } from '../ui';
import { clearGastosToken, gastosService } from '../../services/gastos.service';
import type { GastosAccesoFallo } from '../../types/gastos.types';

interface GastosGateProps {
  children: React.ReactNode;
}

// Lo que el contenido protegido puede pedirle al gate. Hoy solo `bloquear`: el
// token de la sección venció a mitad de sesión (el backend devolvió
// GASTOS_TOKEN_*), así que se tira el token y se vuelve a pedir la contraseña.
interface GastosGateApi {
  bloquear: () => void;
}

const GastosGateContext = createContext<GastosGateApi>({ bloquear: () => {} });

export function useGastosGate(): GastosGateApi {
  return useContext(GastosGateContext);
}

const FALLO_EXPIRADO: GastosAccesoFallo = {
  tipo: 'expirado',
  mensaje: 'Tu acceso a la sección venció. Ingresá la contraseña de nuevo.',
};

// Segunda llave de la sección: aunque ya estés logueado como super admin, el
// contenido no se monta hasta que la contraseña de la sección sea válida.
// Diseño: backend/docs/gastos-superadmin.md §3
export function GastosGate({ children }: GastosGateProps) {
  const [verificando, setVerificando] = useState(true);
  const [habilitado, setHabilitado] = useState(false);
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<GastosAccesoFallo | null>(null);

  // ¿Hay un token guardado que siga valiendo?
  useEffect(() => {
    let cancelado = false;

    gastosService.verificarAcceso()
      .then((valido) => {
        if (!cancelado) setHabilitado(valido);
      })
      .finally(() => {
        if (!cancelado) setVerificando(false);
      });

    return () => { cancelado = true; };
  }, []);

  const bloquear = useCallback(() => {
    clearGastosToken();
    setHabilitado(false);
    setPassword('');
    setFallo(FALLO_EXPIRADO);
  }, []);

  const api = useMemo<GastosGateApi>(() => ({ bloquear }), [bloquear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || enviando) return;

    setEnviando(true);
    setFallo(null);

    try {
      await gastosService.validarAcceso(password);
      setPassword('');
      setHabilitado(true);
    } catch (error) {
      setFallo(error as GastosAccesoFallo);
      setPassword('');
    } finally {
      setEnviando(false);
    }
  };

  if (verificando) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (habilitado) {
    return <GastosGateContext.Provider value={api}>{children}</GastosGateContext.Provider>;
  }

  const bloqueado = fallo?.tipo === 'demasiados_intentos' || fallo?.tipo === 'no_configurado';

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            {bloqueado ? (
              <ShieldAlert size={24} className="text-red-500" />
            ) : (
              <Lock size={24} className="text-gray-500" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Sección protegida</h1>
          <p className="text-sm text-gray-600 mt-2">
            {fallo?.tipo === 'expirado'
              ? fallo.mensaje
              : 'Ingresá la contraseña de la sección de gastos para continuar.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fallo?.tipo === 'expirado' ? undefined : fallo?.mensaje}
            disabled={enviando || bloqueado}
            autoFocus
            autoComplete="off"
          />

          <Button type="submit" block loading={enviando} disabled={bloqueado || !password.trim()}>
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
