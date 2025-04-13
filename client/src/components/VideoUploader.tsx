import React, { useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

interface VideoUploaderProps {
  onVideoUpload: (url: string) => void;
  currentVideoUrl?: string | null;
  className?: string;
}

export function VideoUploader({ onVideoUpload, currentVideoUrl, className = '' }: VideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(currentVideoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetUpload = () => {
    setVideoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadVideo = useCallback(async (file: File) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('video', file);
      
      const response = await fetch('/api/imgur/upload-video', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header as it's automatically set with boundary for FormData
      }).then(res => res.json());
      
      if (response?.url) {
        setVideoUrl(response.url);
        onVideoUpload(response.url);
        toast({
          title: 'Видео загружено',
          description: 'Видео успешно загружено на сервер',
        });
      } else {
        throw new Error('Ошибка при загрузке видео. Ответ не содержит URL.');
      }
    } catch (error) {
      console.error('Ошибка при загрузке видео:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить видео. Попробуйте еще раз.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [onVideoUpload, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      uploadVideo(file);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Проверяем, что файл - это видео
      if (file.type.startsWith('video/')) {
        uploadVideo(file);
      } else {
        toast({
          title: 'Неподдерживаемый тип файла',
          description: 'Пожалуйста, загрузите видео файл.',
          variant: 'destructive',
        });
      }
    }
  }, [uploadVideo, toast]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`mt-4 space-y-4 ${className}`}>
      {!videoUrl ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={handleButtonClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            className="hidden"
            accept="video/*"
            onChange={handleFileChange}
            ref={fileInputRef}
          />
          <div className="flex flex-col items-center justify-center">
            <Upload className="h-10 w-10 text-gray-400 mb-2" />
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-gray-500 mt-2">Загрузка видео...</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">
                  Перетащите видео сюда или нажмите для выбора
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  MP4, WebM, AVI до 50MB
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex justify-between items-center p-2 bg-gray-50 border-b">
            <span className="text-sm font-medium truncate">Загруженное видео</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetUpload}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            <video
              src={videoUrl}
              controls
              className="w-full h-auto rounded"
              style={{ maxHeight: '200px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}