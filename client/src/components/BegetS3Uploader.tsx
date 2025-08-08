import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, ImageIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from '@/lib/store';

interface BegetS3UploaderProps {
  onUpload: (url: string) => void;
  placeholder?: string;
  accept?: string;
  folder?: string;
}

export function BegetS3Uploader({ 
  onUpload, 
  placeholder = "Выберите файл", 
  accept = "image/*",
  folder = "stories"
}: BegetS3UploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore(state => state.token);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    // Создаем превью
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      formData.append('fileName', file.name);

      console.log('🚀 Загружаем файл в Beget S3:', file.name);
      
      if (!token) {
        throw new Error('Не найден токен авторизации');
      }

      const response = await fetch('/api/beget-s3/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📦 Response status:', response.status);
      console.log('📦 Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Response error text:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('📦 Полный ответ от сервера:', result);

      if (result.success && result.url) {
        console.log('✅ Файл успешно загружен в Beget S3:', result.url);
        console.log('🎯 Вызываем onUpload с URL:', result.url);
        onUpload(result.url);
        toast({
          title: 'Файл загружен',
          description: 'Изображение успешно загружено в облачное хранилище'
        });
      } else {
        console.log('❌ Ответ сервера не содержит success:true или url:', result);
        throw new Error(result.error || 'Ошибка загрузки');
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки в Beget S3:', error);
      toast({
        title: 'Ошибка загрузки',
        description: error instanceof Error ? error.message : 'Не удалось загрузить файл',
        variant: 'destructive'
      });
      // Сбрасываем состояние при ошибке
      setPreview('');
      setFileName('');
    } finally {
      setIsUploading(false);
      // Очищаем input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearPreview = () => {
    setPreview('');
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept={accept}
          className="hidden"
          id="beget-s3-file-input"
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? 'Загружаем...' : placeholder}
        </Button>
      </div>

      {/* Превью загруженного изображения */}
      {preview && (
        <div className="relative">
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-start gap-3">
              <img 
                src={preview} 
                alt="Превью" 
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {fileName}
                </p>
                <p className="text-xs text-gray-500">
                  {isUploading ? 'Загружается...' : 'Загружено в облако'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPreview}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      )}
    </div>
  );
}