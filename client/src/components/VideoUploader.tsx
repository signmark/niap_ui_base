import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Video, X, Link } from 'lucide-react';

interface VideoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}

export function VideoUploader({ value, onChange, placeholder = "Загрузите видео" }: VideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Пожалуйста, выберите видео файл');
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'video');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла');
      }

      const data = await response.json();
      if (data.success && data.url) {
        onChange(data.url);
      } else {
        throw new Error(data.error || 'Неизвестная ошибка');
      }
    } catch (error) {
      console.error('Ошибка загрузки видео:', error);
      alert('Ошибка загрузки видео. Попробуйте еще раз.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  const clearVideo = () => {
    onChange('');
    setUrlInput('');
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative">
          <video
            src={value}
            className="w-full h-32 object-cover rounded border"
            controls
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={clearVideo}
            className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <Video className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            {isUploading ? 'Загрузка...' : placeholder}
          </p>
          <p className="text-xs text-gray-500">
            Перетащите файл сюда или нажмите для выбора
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {!value && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-1" />
            {isUploading ? 'Загрузка...' : 'Загрузить файл'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUrlInput(!showUrlInput)}
            disabled={isUploading}
          >
            <Link className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Вставьте URL видео"
            className="flex-1"
          />
          <Button size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
            OK
          </Button>
        </div>
      )}
    </div>
  );
}