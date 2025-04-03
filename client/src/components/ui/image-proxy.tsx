import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ImageProxyProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

/**
 * Компонент для отображения изображений через прокси
 * Автоматически обрабатывает разные форматы URL (UUID, относительные пути, абсолютные URL)
 */
export function ImageProxy({
  src,
  alt,
  className,
  fallbackSrc = "/placeholder-image.png",
  ...props
}: ImageProxyProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setImgSrc(fallbackSrc);
      return;
    }

    // Обработка URL
    if (src.startsWith('http')) {
      // Проверяем, содержит ли URL UUID Directus
      const uuidInUrlPattern = /\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
      const match = src.match(uuidInUrlPattern);
      
      if (match && match[1]) {
        // Если нашли UUID в URL, переформируем URL для использования прокси
        const uuid = match[1];
        setImgSrc(`/api/proxy-file/${uuid}`);
      } else {
        setImgSrc(src);
      }
    } else {
      // Проверка, является ли это UUID для Directus
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (uuidPattern.test(src)) {
        // Это Directus UUID, создаем правильный URL через прокси
        setImgSrc(`/api/proxy-file/${src}`);
      } else {
        // Это локальный файл, добавляем базовый URL если нужно
        setImgSrc(src.startsWith('/') ? src : `/${src}`);
      }
    }
  }, [src, fallbackSrc]);

  const handleError = () => {
    setError(true);
    setImgSrc(fallbackSrc);
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={cn(className)}
      onError={handleError}
      {...props}
    />
  );
}