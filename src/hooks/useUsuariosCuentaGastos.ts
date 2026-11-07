import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { gastosService } from '../services/gastos.service';
import { periodoActual } from '../components/gastos/gastos.utils';
import type { AlcanceCuentaGastos, GastosUsuarioCuenta } from '../types/gastos.types';

// "Cuenta en Gastos" por usuario, para la pantalla de Usuarios (gastos-ingresos-plan P4).
// Solo el super admin: con `habilitado = false` no se pide nada (clave null) y
// admins y staff no ven ni disparan nada nuevo. No usa la contraseña de la
// sección Gastos. La clave vive bajo el prefijo de gastos: cualquier mutación de
// gastos (y la de este hook) la invalida junto con el resto.
export function useUsuariosCuentaGastos(habilitado: boolean) {
  const { data, loading, error, revalidate } = useFetch(
    habilitado ? buildKey(ENTITIES.GASTOS, 'usuarios-cuenta') : null,
    () => gastosService.getUsuariosCuenta(),
    { ttl: TTL.SHORT, persist: false }
  );

  const porUsuario = useMemo(() => {
    const mapa = new Map<string, GastosUsuarioCuenta>();
    for (const u of data?.usuarios ?? []) mapa.set(u.usuario_id, u);
    return mapa;
  }, [data]);

  // El mes "actual" lo decide el backend (su huso); si todavía no llegó, el del navegador
  const periodo = data?.periodo_actual ?? periodoActual();

  // Tira si falla: el modal muestra el error y queda abierto
  const cambiar = useCallback(
    async (usuarioId: string, cuenta: boolean, alcance: AlcanceCuentaGastos, mes?: string) => {
      const actualizado = await gastosService.cambiarCuentaUsuario(usuarioId, cuenta, alcance, mes);
      revalidate();
      return actualizado;
    },
    [revalidate]
  );

  return {
    porUsuario,
    periodoActual: periodo,
    loading: habilitado && loading,
    error: habilitado ? error : null,
    revalidate,
    cambiar,
  };
}
