import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { UploadProgress } from './UploadProgress';

/**
 * Функция для преобразования URL изображения в прокси-URL
 * @param url Исходный URL изображения
 * @returns Прокси-URL изображения
 */
export function getProxiedImageUrl(url: string): string {
  if (!url) return '';
  
  // Пропускаем URL, которые уже проксированы
  if (url.startsWith('/api/proxy-image')) return url;
  
  // Для imgur ссылок и других внешних источников используем прокси
  if (url.match(/^https?:\/\//)) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  
  return url;
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  id: string;
  forcePreview?: boolean; // Новый параметр для принудительного отображения превью
}

export function ImageUploader({ 
  value, 
  onChange, 
  placeholder = "Введите URL изображения", 
  id, 
  forcePreview = false 
}: ImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Для загрузки превью изображения
  const [showPreview, setShowPreview] = useState(forcePreview);
  const [previewUrl, setPreviewUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState<string>('');

  // Обновление превью и отображаемого URL при изменении значения
  useEffect(() => {
    if (value && value.trim() !== '') {
      // Используем прокси URL для превью изображения
      setPreviewUrl(getProxiedImageUrl(value));
      // Если forcePreview=true или уже показываем превью, то продолжаем показывать
      setShowPreview(forcePreview || showPreview);
      setDisplayUrl(value.length > 50 ? value.substring(0, 47) + '...' : value);
    } else {
      setShowPreview(false);
      setPreviewUrl('');
      setDisplayUrl('');
    }
  }, [value, forcePreview]);

  // Обработка загрузки файла
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('image', file);
      
      setIsUploading(true);
      
      try {
        console.log('Отправка запроса на загрузку файла...');
        const response = await axios.post('/api/imgur/upload-file', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        // НОВЫЙ КОД: выводим больше информации для отладки
        console.log('СЫРОЙ ОТВЕТ:', response);
        console.log('DATA:', response.data);
        console.log('DATA.DATA:', response.data.data);
        console.log('DUMP FULL JSON:', JSON.stringify(response.data, null, 2));
        console.log('RESPONSE URL:', response.data.url);
        console.log('RESPONSE LINK:', response.data.link);
        
        // Просто берем URL из корня ответа - после изменения серверного кода
        const imageUrl = response.data.url || response.data.link;
        
        if (imageUrl) {
          console.log('ИТОГОВЫЙ URL изображения для вставки (из корня):', imageUrl);
          onChange(imageUrl);
          // Используем прокси URL для превью изображения
          setPreviewUrl(getProxiedImageUrl(imageUrl));
          setShowPreview(true);
          toast({
            title: 'Успешно',
            description: 'Изображение загружено'
          });
          
          // Очищаем поле выбора файла
          e.target.value = '';
        } else {
          // Если в корне ответа нет URL, ищем в data
          let nestedUrl = '';
          if (response.data.data) {
            if (response.data.data.url) {
              nestedUrl = response.data.data.url;
              console.log('Найден URL в response.data.data.url:', nestedUrl);
            } else if (response.data.data.link) {
              nestedUrl = response.data.data.link;
              console.log('Найден URL в response.data.data.link:', nestedUrl);
            }
          }
          
          if (nestedUrl) {
            console.log('ИТОГОВЫЙ URL изображения для вставки (из data):', nestedUrl);
            onChange(nestedUrl);
            // Используем прокси URL для превью изображения
            setPreviewUrl(getProxiedImageUrl(nestedUrl));
            setShowPreview(true);
            toast({
              title: 'Успешно',
              description: 'Изображение загружено'
            });
            
            // Очищаем поле выбора файла
            e.target.value = '';
          } else {
            console.error('Не удалось извлечь URL изображения из ответа сервера');
            toast({
              title: 'Изображение загружено, но...',
              description: 'URL не получен. Пожалуйста, вставьте его вручную из консоли разработчика (F12).',
              variant: 'destructive'
            });
          }
        }
      } catch (error: any) {
        console.error('Ошибка при загрузке файла:', error);
        toast({
          title: 'Ошибка',
          description: error.message || 'Ошибка при загрузке изображения',
          variant: 'destructive'
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Обработчик начала загрузки изображения
  const handleImageLoadStart = () => {
    setIsLoading(true);
  };

  // Обработчик окончания загрузки изображения
  const handleImageLoaded = () => {
    setIsLoading(false);
  };

  return (
    <div className="space-y-2 w-full">
      <div className="flex gap-2 w-full">
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <div className="relative flex-shrink-0">
          <Input
            type="file"
            accept="image/*"
            id={`${id}-upload`}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            onChange={handleFileUpload}
            disabled={isUploading}
            aria-label="Загрузить изображение"
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
      
      {/* Индикатор загрузки скрыт по запросу пользователя */}
      
      {/* Отображаем URL, если он есть */}
      {value && value.trim() !== '' && (
        <div className="text-xs text-muted-foreground ml-1 mt-1 break-all">
          <span className="flex-shrink-0">URL:</span>
          <span className="break-all">{value}</span>
        </div>
      )}
      
      {showPreview && previewUrl && (
        <div className="mt-2 border rounded-md p-2 bg-muted/20">
          <div className="text-xs text-muted-foreground mb-1">Предпросмотр изображения:</div>
          <div className="relative w-full h-40 rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {previewUrl ? (
              <>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                    <UploadProgress 
                      isLoading={true} 
                      size="large" 
                      label="Загрузка изображения..." 
                    />
                  </div>
                )}
                <img 
                  src={previewUrl} 
                  alt="Предпросмотр" 
                  className="max-h-full max-w-full object-contain"
                  onLoadStart={handleImageLoadStart}
                  onLoad={handleImageLoaded}
                  onError={() => {
                    setIsLoading(false);
                    toast({
                      title: 'Ошибка загрузки превью',
                      description: 'Не удалось загрузить изображение для предпросмотра',
                      variant: 'destructive'
                    });
                  }}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="h-10 w-10 mb-2" />
                <span>Нет изображения</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}