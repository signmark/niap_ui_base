import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface SimpleImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}

export function SimpleImageUploader({ 
  value, 
  onChange, 
  placeholder = "Введите URL изображения" 
}: SimpleImageUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('image', file);

      setIsUploading(true);

      try {
        const response = await axios.post('/api/imgur/upload-file', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        console.log('📤 Ответ от сервера:', response.data);

        const imageUrl = response.data.url || response.data.link;
        
        if (imageUrl) {
          setLocalValue(imageUrl);
          onChange(imageUrl);
          toast({
            title: 'Успешно',
            description: 'Изображение загружено'
          });
          // НЕ очищаем e.target.value чтобы не сбрасывать состояние
        } else {
          throw new Error('URL изображения не получен');
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
    <div className="space-y-2">
      <Input
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
      />
      
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          id="simple-file-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('simple-file-upload')?.click()}
          disabled={isUploading}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? 'Загружается...' : 'Выбрать файл'}
        </Button>
      </div>
    </div>
  );
}