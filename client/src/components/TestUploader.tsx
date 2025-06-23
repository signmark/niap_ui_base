import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { uploadImageToBegetS3 } from '@/lib/s3Client';
import { uploadVideoToBegetS3 } from '@/lib/s3VideoClient';

export function TestUploader() {
  const [urls, setUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of files) {
        console.log('Загружаем файл:', file.name, file.type, 'размер:', file.size);
        
        let result;
        if (file.type.startsWith('image/')) {
          console.log('Загружаем изображение через uploadImageToBegetS3');
          result = await uploadImageToBegetS3(file);
        } else if (file.type.startsWith('video/')) {
          console.log('Загружаем видео через uploadVideoToBegetS3');
          result = await uploadVideoToBegetS3(file);
        } else {
          console.log('Неподдерживаемый тип файла:', file.type);
          continue;
        }

        console.log('Результат загрузки:', result);
        if (result && result.url) {
          console.log('Получен URL:', result.url);
          newUrls.push(result.url);
        } else {
          console.log('URL не получен или пустой результат');
        }
      }

      const allUrls = [...urls, ...newUrls];
      setUrls(allUrls);
      console.log('Обновляем состояние URLs:', allUrls);
      toast({
        title: 'Успешно',
        description: `Загружено ${newUrls.length} файлов`
      });
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить файлы',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Тест загрузки файлов</h3>
      
      <div>
        <Input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
      </div>

      {isUploading && <div>Загрузка...</div>}

      <div className="space-y-2">
        <h4 className="font-medium">Загруженные файлы:</h4>
        {urls.map((url, index) => (
          <div key={index} className="p-2 bg-gray-50 rounded text-sm break-all space-y-2">
            <div>URL: <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500">{url}</a></div>
            {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img src={url} alt="Preview" className="max-w-xs max-h-32 object-contain" />
            ) : url.match(/\.(mp4|webm|mov)$/i) ? (
              <video src={url} controls className="max-w-xs max-h-32" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}