import React, { useState, useRef, ChangeEvent } from 'react';
import { uploadImage, uploadMultipleImages } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Image, Upload, X, CheckCircle2 } from 'lucide-react';

interface ImageUploaderProps {
  onImageUploaded: (imageUrl: string) => void;
  onMultipleImagesUploaded?: (imageUrls: string[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
  label?: string;
}

interface UploadedFile {
  id: string;
  url: string;
  name: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUploaded,
  onMultipleImagesUploaded,
  multiple = false,
  maxFiles = 10,
  className = '',
  label = 'Загрузить изображение'
}) => {
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Проверяем количество файлов при множественной загрузке
    if (multiple && files.length > maxFiles) {
      toast({
        title: 'Превышен лимит файлов',
        description: `Вы можете загрузить не более ${maxFiles} файлов за раз`,
        variant: 'destructive'
      });
      return;
    }
    
    // Проверка токена авторизации
    const token = localStorage.getItem('auth_token');
    console.log('ImageUploader: Auth token present:', !!token);
    if (!token) {
      toast({
        title: 'Ошибка авторизации',
        description: 'Отсутствует токен авторизации. Попробуйте перезайти в систему.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    // Создаем временные записи для отображения прогресса
    const tempUploads: UploadedFile[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(2),
      url: URL.createObjectURL(file),
      name: file.name,
      progress: 0,
      status: 'uploading'
    }));

    setUploads(tempUploads);

    try {
      if (multiple) {
        const response = await uploadMultipleImages(Array.from(files));
        if (response.success) {
          // Обновляем статус загрузок
          const updatedUploads = tempUploads.map((upload, index) => ({
            ...upload,
            url: response.files[index].fileUrl,
            progress: 100,
            status: 'success' as const
          }));
          
          setUploads(updatedUploads);
          
          // Вызываем callback для множественной загрузки
          if (onMultipleImagesUploaded) {
            const urls = response.files.map((file: any) => file.fileUrl);
            onMultipleImagesUploaded(urls);
          } else if (onImageUploaded) {
            // Если callback для множественной загрузки не предоставлен, вызываем обычный callback с первым URL
            onImageUploaded(response.files[0].fileUrl);
          }
          
          toast({
            title: 'Загрузка завершена',
            description: `Успешно загружено ${files.length} изображений`,
            variant: 'default'
          });
        }
      } else {
        // Загружаем один файл
        const response = await uploadImage(files[0]);
        if (response.success) {
          // Обновляем статус загрузки
          setUploads([{
            id: tempUploads[0].id,
            url: response.fileUrl,
            name: files[0].name,
            progress: 100,
            status: 'success'
          }]);
          
          // Вызываем callback
          onImageUploaded(response.fileUrl);
          
          toast({
            title: 'Загрузка завершена',
            description: 'Изображение успешно загружено',
            variant: 'default'
          });
        }
      }
    } catch (error: any) {
      console.error('Ошибка при загрузке файлов:', error);
      
      // Обновляем статус загрузок на ошибку
      setUploads(prevUploads => 
        prevUploads.map(upload => ({
          ...upload,
          status: 'error',
          error: error.message || 'Ошибка при загрузке файла'
        }))
      );
      
      toast({
        title: 'Ошибка загрузки',
        description: error.message || 'Произошла ошибка при загрузке файлов',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploads(uploads.filter(upload => upload.id !== id));
  };

  const handleButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleButtonClick}
          disabled={isUploading}
          className="flex items-center gap-2"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {label}
        </Button>
        <Input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
        />
        {uploads.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {uploads.filter(u => u.status === 'success').length} из {uploads.length} загружено
          </span>
        )}
      </div>

      {uploads.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uploads.map(file => (
            <div 
              key={file.id} 
              className="relative rounded-md border p-2 flex flex-col gap-2"
            >
              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                <img 
                  src={file.url} 
                  alt={file.name}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMWYxZjEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEycHgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTk5OTkiPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFile(file.id)}
                  className="absolute top-2 right-2 p-1 bg-background/80 backdrop-blur-sm rounded-full hover:bg-background/90 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                {file.status === 'success' && (
                  <div className="absolute bottom-2 right-2 p-1 bg-background/80 backdrop-blur-sm rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                )}
                {file.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                {file.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <div className="text-center p-4">
                      <X className="h-8 w-8 text-destructive mx-auto mb-2" />
                      <p className="text-xs text-destructive">{file.error || 'Ошибка загрузки'}</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs truncate" title={file.name}>{file.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;