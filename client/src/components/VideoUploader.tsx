import React, { useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X, Link as LinkIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VideoUploaderProps {
  onVideoUpload: (url: string) => void;
  currentVideoUrl?: string | null;
  className?: string;
}

export function VideoUploader({ onVideoUpload, currentVideoUrl, className = '' }: VideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(currentVideoUrl || null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetUpload = () => {
    setVideoUrl(null);
    setUrlInput('');
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

  const uploadVideoFromUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      toast({
        title: 'Поле не заполнено',
        description: 'Пожалуйста, введите URL видео',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Проверяем, что видео доступно, пытаясь получить к нему доступ через HEAD запрос
      const checkVideo = async (url: string) => {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          return response.ok && 
                 (response.headers.get('content-type')?.includes('video/') || 
                  url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov'));
        } catch (error) {
          console.error('Ошибка при проверке видео:', error);
          return false;
        }
      };
      
      // Если URL доступен и это похоже на видео - используем его напрямую
      if (await checkVideo(urlInput)) {
        setVideoUrl(urlInput);
        onVideoUpload(urlInput);
        toast({
          title: 'Видео добавлено',
          description: 'Видео по указанному URL успешно добавлено',
        });
      } else {
        // Если не получилось напрямую, пробуем через сервис
        try {
          const response = await fetch('/api/imgur/upload-video-from-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoUrl: urlInput }),
          }).then(res => res.json());
          
          if (response?.success && response?.data?.url) {
            setVideoUrl(response.data.url);
            onVideoUpload(response.data.url);
            toast({
              title: 'Видео загружено',
              description: 'Видео успешно загружено с указанного URL',
            });
          } else {
            throw new Error('Ошибка при загрузке видео. Ответ не содержит URL.');
          }
        } catch (uploadError) {
          console.error('Ошибка при загрузке видео через сервис:', uploadError);
          // Предполагаем, что URL доступен напрямую, даже если проверка не сработала
          setVideoUrl(urlInput);
          onVideoUpload(urlInput);
          toast({
            title: 'Видео добавлено',
            description: 'Видео добавлено напрямую, без загрузки на сервер',
          });
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке видео по URL:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить видео по указанному URL. Проверьте ссылку и попробуйте еще раз.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [urlInput, onVideoUpload, toast]);

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
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Загрузить файл</TabsTrigger>
            <TabsTrigger value="url">Вставить ссылку</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
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
          </TabsContent>
          
          <TabsContent value="url">
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <LinkIcon className="h-5 w-5 text-gray-400" />
                <Input
                  placeholder="https://example.com/video.mp4"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isUploading}
                />
              </div>
              
              <Button
                onClick={uploadVideoFromUrl}
                disabled={isUploading || !urlInput.trim()}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  'Загрузить видео по URL'
                )}
              </Button>
              
              <p className="text-xs text-gray-500 text-center">
                Поддерживаются ссылки на MP4, WebM и другие распространенные форматы видео
              </p>
            </div>
          </TabsContent>
        </Tabs>
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