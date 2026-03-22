import React, { useState } from 'react';
import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

export const RegisterPage: React.FC = () => {
  const [form, setForm] = useState({
    empresa_nombre: '',
    empresa_dominio: '',
    empresa_plan: 'basico',
    usuario_nombre: '',
    usuario_username: '',
    usuario_email: '',
    usuario_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await axios.post(`${API_URL}/register`, form);
      setResult(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Registrar Empresa</h1>
        <p className="text-sm text-red-500 mb-6">⚠️ Ruta temporal — eliminar tras el registro</p>

        {result ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-green-700">¡Empresa creada exitosamente!</p>
            <p className="text-sm text-gray-700"><span className="font-medium">Empresa ID:</span> {result.empresa.id}</p>
            <p className="text-sm text-gray-700"><span className="font-medium">Dominio:</span> {result.empresa.dominio}</p>
            <p className="text-sm text-gray-700"><span className="font-medium">Usuario ID:</span> {result.usuario.id}</p>
            <p className="text-sm text-gray-700"><span className="font-medium">Email:</span> {result.usuario.email}</p>
            <p className="text-sm text-gray-700"><span className="font-medium">Roles:</span> {result.usuario.roles.join(', ')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Empresa</p>
              <div className="space-y-3">
                <input
                  name="empresa_nombre"
                  placeholder="Nombre de la empresa"
                  value={form.empresa_nombre}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  name="empresa_dominio"
                  placeholder="Dominio / slug (ej: debsalon)"
                  value={form.empresa_dominio}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  name="empresa_plan"
                  value={form.empresa_plan}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="basico">Básico</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Usuario Admin</p>
              <div className="space-y-3">
                <input
                  name="usuario_nombre"
                  placeholder="Nombre completo"
                  value={form.usuario_nombre}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  name="usuario_username"
                  placeholder="Username"
                  value={form.usuario_username}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  name="usuario_email"
                  type="email"
                  placeholder="Email"
                  value={form.usuario_email}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  name="usuario_password"
                  type="password"
                  placeholder="Contraseña"
                  value={form.usuario_password}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Crear empresa y usuario'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
