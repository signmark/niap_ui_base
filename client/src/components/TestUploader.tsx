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
        console.log('Загружаем файл:', file.name, file.type);
        
        let result;
        if (file.type.startsWith('image/')) {
          result = await uploadImageToBegetS3(file);
        } else if (file.type.startsWith('video/')) {
          result = await uploadVideoToBegetS3(file);
        } else {
          console.log('Неподдерживаемый тип файла:', file.type);
          continue;
        }

        if (result && result.url) {
          console.log('Получен URL:', result.url);
          newUrls.push(result.url);
        }
      }

      setUrls(prev => [...prev, ...newUrls]);
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
          <div key={index} className="p-2 bg-gray-50 rounded text-sm break-all">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500">
              {url}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}