import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  id: string;
}

export function ImageUploader({ value, onChange, placeholder = "Введите URL изображения", id }: ImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState<string>('');

  // Обновление превью и отображаемого URL при изменении значения
  useEffect(() => {
    if (value && value.trim() !== '') {
      setPreviewUrl(value);
      setShowPreview(true);
      setDisplayUrl(value.length > 50 ? value.substring(0, 47) + '...' : value);
    } else {
      setShowPreview(false);
      setPreviewUrl('');
      setDisplayUrl('');
    }
  }, [value]);

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
        
        console.log('Получен ответ от сервера:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
          toast({
            title: 'Успешно',
            description: 'Изображение загружено'
          });
          
          // Извлекаем URL из ответа сервера с подробной проверкой
          let imageUrl = '';
          if (response.data.data) {
            if (response.data.data.url) {
              imageUrl = response.data.data.url;
              console.log('Найден URL в response.data.data.url:', imageUrl);
            } else if (response.data.data.link) {
              imageUrl = response.data.data.link;
              console.log('Найден URL в response.data.data.link:', imageUrl);
            } else {
              console.warn('URL не найден в ожидаемых полях ответа:', response.data.data);
              // Поиск URL в любом поле ответа
              for (const key in response.data.data) {
                const value = response.data.data[key];
                if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                  imageUrl = value;
                  console.log(`Найден альтернативный URL в поле ${key}:`, imageUrl);
                  break;
                }
              }
            }
          }
          
          if (imageUrl) {
            console.log('ИТОГОВЫЙ URL изображения для вставки:', imageUrl);
            onChange(imageUrl);
            setPreviewUrl(imageUrl);
            setShowPreview(true);
          } else {
            console.error('Не удалось извлечь URL изображения из ответа сервера');
            toast({
              title: 'Предупреждение',
              description: 'Изображение загружено, но URL не получен. Пожалуйста, сообщите разработчикам.',
              variant: 'destructive'
            });
          }
          
          // Очищаем поле выбора файла
          e.target.value = '';
        } else {
          toast({
            title: 'Ошибка',
            description: response.data.error || 'Неизвестная ошибка при загрузке',
            variant: 'destructive'
          });
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
        <div className="relative">
          <Input
            type="file"
            accept="image/*"
            id={`${id}-upload`}
            className="absolute inset-0 opacity-0 w-full cursor-pointer"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            className="h-9 w-9"
            disabled={isUploading}
          >
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Всегда отображаем URL, если он есть */}
      {value && value.trim() !== '' && (
        <div className="text-xs text-muted-foreground ml-1 mt-1 break-all">
          URL: {value}
        </div>
      )}
      
      {showPreview && previewUrl && (
        <div className="mt-2 border rounded-md p-2 bg-muted/20">
          <div className="text-xs text-muted-foreground mb-1">Предпросмотр изображения:</div>
          <div className="relative w-full h-40 rounded-md overflow-hidden bg-muted flex items-center justify-center">
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Предпросмотр" 
                className="max-h-full max-w-full object-contain"
                onError={() => {
                  toast({
                    title: 'Ошибка загрузки превью',
                    description: 'Не удалось загрузить изображение для предпросмотра',
                    variant: 'destructive'
                  });
                }}
              />
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