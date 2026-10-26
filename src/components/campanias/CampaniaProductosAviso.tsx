import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { productosService } from '../../services/productos.service';
import type { Producto } from '../../types/producto.types';
import { FILTRO_SIN_DURACION, PARAM_FILTRO_PRODUCTOS } from '../../utils/productoCampanias.utils';

// Reposición y seguimiento solo miran productos con datos cargados (duración o días de
// seguimiento). Si ninguno activo los tiene, la campaña no le llega a nadie: la pestaña lo
// dice y lleva a Productos (spec de productos §8).

export type TipoCampaniaProducto = 'reposicion_producto' | 'seguimiento_producto';


export function contarProductosConDatos(productos: Producto[], tipo: TipoCampaniaProducto): number {
  return productos.filter((p) =>
    p.activo && (tipo === 'reposicion_producto' ? p.duracion_estimada_dias != null : p.seguimiento_dias != null)
  ).length;
}

export function claveProductosCampania(): string {
  return buildKey(ENTITIES.PRODUCTS, 'campanias', 'datos');
}

export function CampaniaProductosAviso({ tipo }: { tipo: TipoCampaniaProducto }) {
  const { data, error } = useFetch(
    claveProductosCampania(),
    () => productosService.getProductos(),
    { ttl: TTL.SHORT }
  );

  if (error) {
    return (
      <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm" role="status">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>No pudimos revisar qué productos tienen los datos cargados. Podés verlo en <Link to="/productos" className="font-medium underline">Productos</Link>.</p>
      </div>
    );
  }
  if (!data) return null;
  if (contarProductosConDatos(data, tipo) > 0) return null;

  const esReposicion = tipo === 'reposicion_producto';
  return (
    <div
      className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2 text-sm"
      role="status"
      data-testid="aviso-productos-sin-datos"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        {esReposicion
          ? 'Todavía ningún producto tiene cargado cuánto dura, así que esta campaña no le llega a nadie. Cargalo en '
          : 'Todavía ningún producto tiene cargado a los cuántos días preguntar cómo le está resultando, así que esta campaña no le llega a nadie. Cargalo en '}
        <Link
          to={esReposicion ? `/productos?${PARAM_FILTRO_PRODUCTOS}=${FILTRO_SIN_DURACION}` : '/productos'}
          className="font-medium underline hover:text-yellow-900"
        >
          Productos
        </Link>
        {esReposicion ? ' (te mostramos los que no tienen la duración).' : ' (en cada producto, el campo «Seguimiento a los (días)»).'}
      </p>
    </div>
  );
}
