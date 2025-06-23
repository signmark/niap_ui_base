import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, VideoIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { UploadProgress } from './UploadProgress';

/**
 * Утилита для проверки URL на видео-формат
 * @param url URL для проверки
 * @returns true если URL указывает на видеофайл
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;

  // Проверяем расширение файла или URL
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv'];
  const hasVideoExtension = videoExtensions.some(ext => url.toLowerCase().includes(ext));

  // Проверяем, является ли URL ссылкой на S3 хранилище Beget
  const isBegetS3Url = url.includes('s3.ru1.storage.beget.cloud');

  // Проверяем URL видеохостингов
  const isVideoHosting = url.includes('youtube.com/watch') || 
                         url.includes('youtu.be/') || 
                         url.includes('vimeo.com/');

  return hasVideoExtension || isBegetS3Url || isVideoHosting;
}

interface VideoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  id?: string;
  forcePreview?: boolean;
}

export function VideoUploader({ 
  value, 
  onChange, 
  placeholder = "Введите URL видео", 
  id, 
  forcePreview = false 
}: VideoUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Для загрузки превью видео
  const [showPreview, setShowPreview] = useState(forcePreview);
  const [previewUrl, setPreviewUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState<string>('');

  const [inputValue, setInputValue] = useState(value || '');

  // Обновляем превью и отображение URL при изменении значения
  useEffect(() => {
    console.log('VideoUploader useEffect - value изменен:', value);
    console.log('VideoUploader useEffect - текущий inputValue:', inputValue);
    
    const newValue = value || '';
    
    // Обновляем inputValue только если value действительно изменился
    if (inputValue !== newValue) {
      setInputValue(newValue);
      console.log('VideoUploader useEffect - синхронизируем inputValue с value:', newValue);
    }
    
    if (newValue && newValue.trim() !== '') {
      setPreviewUrl(newValue);
      setShowPreview(forcePreview || true);
      setDisplayUrl(newValue.length > 50 ? newValue.substring(0, 47) + '...' : newValue);
      console.log('VideoUploader useEffect - установили превью и отображение для:', newValue);
    } else {
      setShowPreview(false);
      setPreviewUrl('');
      setDisplayUrl('');
      console.log('VideoUploader useEffect - очистили превью и отображение');
    }
  }, [value, forcePreview]);

  // Обработка загрузки файла
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      console.log('Загружаем файл:', file.name, 'размер:', file.size);
      const formData = new FormData();
      formData.append('file', file);

      setIsUploading(true);

      try {
        console.log('Отправка запроса на загрузку видео файла...');

        // Получаем токен авторизации из localStorage
        const token = localStorage.getItem('auth_token');

        const response = await axios.post('/api/beget-s3-aws/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });

        console.log('Ответ от API загрузки видео:', response.data);

        if (response.data && response.data.success && response.data.url) {
          const videoUrl = response.data.url;
          console.log('Полученный URL видео:', videoUrl);
          console.log('Вызываем onChange с URL:', videoUrl);
          
          // Важно: сначала вызываем onChange, потом обновляем локальное состояние
          console.log('Вызываем onChange с URL:', videoUrl);
          onChange(videoUrl);
          
          console.log('Устанавливаем inputValue:', videoUrl);
          setInputValue(videoUrl);
          setPreviewUrl(videoUrl);
          setShowPreview(true);
          
          console.log('VideoUploader: состояние обновлено с URL:', videoUrl);
          

          
          toast({
            title: 'Успешно',
            description: `Видео загружено: ${videoUrl.split('/').pop()}`
          });

          // Очищаем поле выбора файла
          if (e.target.files) {
            e.target.value = '';
          }
        } else {
          console.error('Не удалось извлечь URL видео из ответа сервера');
          console.error('Полный ответ сервера:', response.data);
          toast({
            title: 'Ошибка',
            description: response.data?.error || 'Не удалось загрузить видео',
            variant: 'destructive'
          });
        }
      } catch (error: any) {
        console.error('Ошибка при загрузке видео:', error);
        toast({
          title: 'Ошибка',
          description: error.response?.data?.error || error.message || 'Ошибка при загрузке видео',
          variant: 'destructive'
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Обработчик начала загрузки видео
  const handleVideoLoadStart = () => {
    setIsLoading(true);
  };

  // Обработчик окончания загрузки видео
  const handleVideoLoaded = () => {
    setIsLoading(false);
  };

  return (
    <div className="space-y-2 w-full">
      <div className="flex gap-2 w-full">
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            const newValue = e.target.value;
            console.log('Input onChange:', newValue);
            setInputValue(newValue);
            onChange(newValue);
          }}
          className="flex-1"
        />
        <div className="relative flex-shrink-0">
          <Input
            type="file"
            accept="video/*"
            id={`${id}-upload`}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            onChange={handleFileUpload}
            disabled={isUploading}
            aria-label="Загрузить видео"
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            className="h-9 w-9 flex items-center justify-center"
            tabIndex={-1}
            aria-hidden="true"
            disabled={isUploading}
          >
            <span className="sr-only">Загрузить</span>
            {isUploading ? (
              <div 
                className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
                aria-hidden="true" 
              />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {value && value.trim() !== '' && (
        <div className="text-xs text-muted-foreground ml-1 mt-1 break-all">
          <span className="flex-shrink-0">URL:</span>
          <span className="break-all">{value}</span>
        </div>
      )}

      {showPreview && previewUrl && (
        <div className="mt-2 border rounded-md p-2 bg-muted/20">
          <div className="text-xs text-muted-foreground mb-1">Предпросмотр видео:</div>
          <div className="relative w-full h-auto rounded-md overflow-hidden bg-muted">
            {isVideoUrl(previewUrl) ? (
              <>
                <video 
                  src={previewUrl} 
                  controls
                  preload="metadata"
                  className="max-w-full h-auto max-h-60"
                  onLoadStart={handleVideoLoadStart}
                  onLoadedData={handleVideoLoaded}
                  onError={() => {
                    setIsLoading(false);
                    toast({
                      title: 'Ошибка загрузки превью',
                      description: 'Не удалось загрузить видео для предпросмотра',
                      variant: 'destructive'
                    });
                  }}
                ></video>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground py-10">
                <VideoIcon className="h-10 w-10 mb-2" />
                <span>Не удалось отобразить превью видео</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}