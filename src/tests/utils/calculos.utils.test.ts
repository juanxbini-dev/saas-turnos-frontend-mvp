import { vi } from 'vitest';
import { calcularComisiones, formatCurrency, formatDate, generarId } from '../../utils/calculos.utils';

// ─── calcularComisiones ───────────────────────────────────────────────────────

describe('calcularComisiones', () => {
  const configBase = { comision_turno: 20, comision_producto: 30 };

  describe('solo servicio, sin descuento', () => {
    it('subtotalOriginal es igual al montoServicio', () => {
      const resultado = calcularComisiones(1000, 0, 0, configBase);
      expect(resultado.subtotalOriginal).toBe(1000);
    });

    it('descuentoMonto es 0 cuando descuentoPorcentaje es 0', () => {
      const resultado = calcularComisiones(1000, 0, 0, configBase);
      expect(resultado.descuentoMonto).toBe(0);
    });

    it('totalConDescuento es igual al subtotal cuando no hay descuento', () => {
      const resultado = calcularComisiones(1000, 0, 0, configBase);
      expect(resultado.totalConDescuento).toBe(1000);
    });

    it('montoEmpresa del servicio es el porcentaje correcto del monto del servicio', () => {
      // comision_turno=20%, servicio=1000 → empresa retiene 200
      const resultado = calcularComisiones(1000, 0, 0, configBase);
      expect(resultado.comisionServicio.montoEmpresa).toBeCloseTo(200, 5);
    });

    it('netoProfesional es el complemento al 100%', () => {
      const resultado = calcularComisiones(1000, 0, 0, configBase);
      expect(resultado.comisionServicio.netoProfesional).toBeCloseTo(800, 5);
    });
  });

  describe('con servicio y productos, sin descuento', () => {
    it('subtotalOriginal es la suma de ambos montos', () => {
      const resultado = calcularComisiones(1000, 500, 0, configBase);
      expect(resultado.subtotalOriginal).toBe(1500);
    });

    it('calcula comisiones de productos independientemente del servicio', () => {
      // comision_producto=30%, productos=500 sin descuento → empresa 150
      const resultado = calcularComisiones(1000, 500, 0, configBase);
      expect(resultado.comisionProductos.montoEmpresa).toBeCloseTo(150, 5);
    });
  });

  describe('descuento 10%', () => {
    it('descuentoMonto es el 10% del subtotal total', () => {
      // subtotal=1500, descuento=10% → descuentoMonto=150
      const resultado = calcularComisiones(1000, 500, 10, configBase);
      expect(resultado.descuentoMonto).toBeCloseTo(150, 5);
    });

    it('totalConDescuento es subtotal menos descuentoMonto', () => {
      const resultado = calcularComisiones(1000, 500, 10, configBase);
      expect(resultado.totalConDescuento).toBeCloseTo(1350, 5);
    });

    it('distribuye el descuento proporcionalmente entre servicio y productos', () => {
      // proporcionServicio = 1000/1500 = 2/3, proporcionProductos = 500/1500 = 1/3
      // descuentoServicio = 150 * 2/3 = 100, servicioConDescuento = 900
      // descuentoProductos = 150 * 1/3 = 50, productosConDescuento = 450
      const resultado = calcularComisiones(1000, 500, 10, configBase);
      expect(resultado.comisionServicio.base).toBeCloseTo(900, 5);
      expect(resultado.comisionProductos.base).toBeCloseTo(450, 5);
    });
  });

  describe('comisión 0%', () => {
    it('empresa no retiene nada del servicio', () => {
      const config = { comision_turno: 0, comision_producto: 0 };
      const resultado = calcularComisiones(1000, 0, 0, config);
      expect(resultado.comisionServicio.montoEmpresa).toBe(0);
    });

    it('profesional recibe el total del servicio', () => {
      const config = { comision_turno: 0, comision_producto: 0 };
      const resultado = calcularComisiones(1000, 0, 0, config);
      expect(resultado.comisionServicio.netoProfesional).toBeCloseTo(1000, 5);
    });
  });

  describe('comisión 100%', () => {
    it('empresa retiene todo el monto del servicio', () => {
      const config = { comision_turno: 100, comision_producto: 100 };
      const resultado = calcularComisiones(1000, 0, 0, config);
      expect(resultado.comisionServicio.montoEmpresa).toBeCloseTo(1000, 5);
    });

    it('profesional recibe 0', () => {
      const config = { comision_turno: 100, comision_producto: 100 };
      const resultado = calcularComisiones(1000, 0, 0, config);
      expect(resultado.comisionServicio.netoProfesional).toBeCloseTo(0, 5);
    });
  });

  describe('suma de partes', () => {
    it('totalEmpresa + totalProfesional === totalRecaudado', () => {
      const resultado = calcularComisiones(1000, 500, 10, configBase);
      const { totalEmpresa, totalProfesional, totalRecaudado } = resultado.totales;
      expect(totalEmpresa + totalProfesional).toBeCloseTo(totalRecaudado, 5);
    });

    it('se cumple la invariante con comisiones distintas entre servicio y producto', () => {
      const config = { comision_turno: 15, comision_producto: 25 };
      const resultado = calcularComisiones(2000, 800, 5, config);
      const { totalEmpresa, totalProfesional, totalRecaudado } = resultado.totales;
      expect(totalEmpresa + totalProfesional).toBeCloseTo(totalRecaudado, 5);
    });
  });

  describe('casos borde de división por cero', () => {
    it('montoProductos=0: no genera NaN — proporción servicio actúa como 1', () => {
      const resultado = calcularComisiones(1000, 0, 10, configBase);
      expect(resultado.comisionServicio.base).toBeCloseTo(900, 5);
      expect(resultado.comisionProductos.base).toBeCloseTo(0, 5);
      expect(resultado.descuentoMonto).toBeCloseTo(100, 5);
    });

    it('montoServicio=0 y montoProductos>0: no genera NaN — proporción productos actúa como 1', () => {
      const resultado = calcularComisiones(0, 500, 10, configBase);
      expect(resultado.comisionProductos.base).toBeCloseTo(450, 5);
      expect(resultado.comisionServicio.base).toBeCloseTo(0, 5);
      expect(resultado.descuentoMonto).toBeCloseTo(50, 5);
    });
  });

  describe('monto cero', () => {
    it('con todo en cero retorna ceros sin errores', () => {
      const resultado = calcularComisiones(0, 0, 0, configBase);
      // subtotal = 0, todos los montos derivados son 0 o NaN
      // Solo verificamos que no lanza excepción y que totalConDescuento es 0
      expect(resultado.subtotalOriginal).toBe(0);
      expect(resultado.totalConDescuento).toBe(0);
    });
  });
});

// ─── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formatea 1000 con separador de miles y símbolo $', () => {
    const result = formatCurrency(1000);
    // El formato es-AR usa punto para miles y contiene $ o $ con espacio
    expect(result).toContain('1.000');
    expect(result).toContain('$');
  });

  it('incluye dos decimales en el resultado', () => {
    const result = formatCurrency(1500.5);
    // Debe terminar con ,50 (es-AR usa coma como separador decimal)
    expect(result).toMatch(/,\d{2}$/);
  });

  it('formatea 0 correctamente', () => {
    const result = formatCurrency(0);
    expect(result).toContain('$');
    expect(result).toContain('0');
  });

  it('formatea números grandes sin perder precisión', () => {
    const result = formatCurrency(1000000);
    expect(result).toContain('$');
    // 1.000.000 en es-AR
    expect(result).toContain('1.000.000');
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it("convierte '2026-04-15' a '15/04/2026'", () => {
    expect(formatDate('2026-04-15')).toBe('15/04/2026');
  });

  it('no tiene off-by-one de timezone: el día no cambia respecto al input', () => {
    // Verificamos que el día retornado sea exactamente el del string input
    const result = formatDate('2026-01-01');
    expect(result).toBe('01/01/2026');
  });

  it('parsea fechas con hora ISO (YYYY-MM-DDTHH:mm:ssZ) usando solo la parte de fecha', () => {
    const result = formatDate('2026-04-15T15:00:00Z');
    expect(result).toBe('15/04/2026');
  });

  it('parsea el último día del año correctamente', () => {
    const result = formatDate('2026-12-31');
    expect(result).toBe('31/12/2026');
  });
});

// ─── generarId ────────────────────────────────────────────────────────────────

describe('generarId', () => {
  it('retorna un string con el formato timestamp_random', () => {
    const id = generarId();
    // Formato: cadena de chars base-36 + underscore + cadena de chars base-36
    expect(id).toMatch(/^[a-z0-9]+_[a-z0-9]+$/);
  });

  it('dos llamadas consecutivas generan IDs distintos', () => {
    const id1 = generarId();
    const id2 = generarId();
    expect(id1).not.toBe(id2);
  });

  it('el ID contiene exactamente un guión bajo', () => {
    const id = generarId();
    const partes = id.split('_');
    expect(partes).toHaveLength(2);
  });

  it('ambas partes del ID son no vacías', () => {
    const id = generarId();
    const [timestamp, random] = id.split('_');
    expect(timestamp.length).toBeGreaterThan(0);
    expect(random.length).toBeGreaterThan(0);
  });
});
