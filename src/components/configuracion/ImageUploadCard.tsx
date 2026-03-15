import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import { Spinner } from '../ui';
import { useToast } from '../../hooks/useToast';

interface ImageUploadCardProps {
  label: string;
  hint: string;
  currentUrl?: string | null;
  aspectRatio?: 'square' | 'landscape';
  onUpload: (file: File) => Promise<void>;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ImageUploadCard({ label, hint, currentUrl, aspectRatio = 'landscape', onUpload }: ImageUploadCardProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Solo se permiten imagenes JPG, PNG o WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setLoading(true);

    try {
      await onUpload(file);
      toast.success(`${label} actualizado`);
    } catch {
      toast.error(`Error al subir ${label.toLowerCase()}`);
      setPreview(null);
    } finally {
      setLoading(false);
      URL.revokeObjectURL(objectUrl);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const displayUrl = preview || currentUrl;
  const containerClass = aspectRatio === 'square'
    ? 'w-32 h-32'
    : 'w-full h-40';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div
        className={`${containerClass} relative rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors`}
        onClick={() => inputRef.current?.click()}
      >
        {displayUrl ? (
          <>
            <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
            {loading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Spinner size="sm" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <Upload className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            {loading ? <Spinner size="sm" /> : <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />}
            <p className="text-xs text-gray-500">{loading ? 'Subiendo...' : 'Click para subir'}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={loading}
      />
    </div>
  );
}
