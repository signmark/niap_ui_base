import React, { useState, useEffect } from 'react';
import { StoryData, StoryElement } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Play, Pause, Maximize, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface StoriesPreviewProps {
  storyData: StoryData;
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StoriesPreview({ storyData, trigger, isOpen, onOpenChange }: StoriesPreviewProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentSlide = storyData.slides[currentSlideIndex];
  const slideDuration = currentSlide?.duration || 5;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && currentSlide) {
      interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (100 / (slideDuration * 10));
          
          if (newProgress >= 100) {
            // Переход к следующему слайду
            if (currentSlideIndex < storyData.slides.length - 1) {
              setCurrentSlideIndex(prev => prev + 1);
              return 0;
            } else {
              setIsPlaying(false);
              return 100;
            }
          }
          
          return newProgress;
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isPlaying, currentSlideIndex, slideDuration, storyData.slides.length]);

  useEffect(() => {
    setProgress(0);
  }, [currentSlideIndex]);

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < storyData.slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      setProgress(0);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const renderElement = (element: StoryElement) => {
    const style = {
      position: 'absolute' as const,
      left: `${(element.position.x / 270) * 100}%`,
      top: `${(element.position.y / 480) * 100}%`,
      transform: element.style?.rotation ? `rotate(${element.style.rotation}deg)` : undefined,
    };

    if (element.type === 'text') {
      return (
        <div
          key={element.id}
          style={{
            ...style,
            fontSize: `${element.style?.fontSize || 16}px`,
            color: element.style?.color || '#000000',
            backgroundColor: element.style?.backgroundColor || 'transparent',
            padding: '4px 8px',
            borderRadius: '4px',
            fontWeight: element.style?.fontWeight || 'normal',
            textAlign: element.style?.textAlign as any || 'left',
            maxWidth: '200px',
            wordWrap: 'break-word'
          }}
          dangerouslySetInnerHTML={{ __html: element.content || '' }}
        />
      );
    }

    if (element.type === 'image') {
      return (
        <img
          key={element.id}
          src={element.content || ''}
          alt=""
          style={{
            ...style,
            width: `${element.style?.width || 100}px`,
            height: `${element.style?.height || 100}px`,
            objectFit: 'cover',
            borderRadius: `${element.style?.borderRadius || 0}px`
          }}
        />
      );
    }

    if (element.type === 'poll') {
      let pollData = { question: 'Ваш вопрос?', options: ['Да', 'Нет'] };
      try {
        pollData = JSON.parse(element.content || '{}');
      } catch (e) {
        // Используем значения по умолчанию
      }

      return (
        <div
          key={element.id}
          style={{
            ...style,
            width: `${element.style?.width || 200}px`,
            height: `${element.style?.height || 80}px`,
            backgroundColor: element.style?.backgroundColor || '#ffffff',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            {pollData.question}
          </div>
          {pollData.options.map((option: string, idx: number) => (
            <div 
              key={idx}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                fontSize: '12px',
                cursor: 'pointer',
                border: '1px solid #e5e7eb'
              }}
            >
              {option}
            </div>
          ))}
        </div>
      );
    }

    if (element.type === 'shape') {
      return (
        <div
          key={element.id}
          style={{
            ...style,
            width: `${element.style?.width || 50}px`,
            height: `${element.style?.height || 50}px`,
            backgroundColor: element.style?.backgroundColor || '#3b82f6',
            borderRadius: `${element.style?.borderRadius || 0}px`
          }}
        />
      );
    }

    return null;
  };

  const renderStoryFrame = () => (
    <div className={`relative mx-auto ${isFullscreen ? 'w-[300px] h-[533px]' : 'w-[270px] h-[480px]'}`}>
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
        {storyData.slides.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100"
              style={{
                width: index < currentSlideIndex ? '100%' : 
                       index === currentSlideIndex ? `${progress}%` : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Story content */}
      <div 
        className="relative w-full h-full rounded-3xl overflow-hidden"
        style={{
          backgroundColor: currentSlide?.background?.color || '#ffffff'
        }}
      >
        {/* Background image if exists */}
        {currentSlide?.background?.type === 'image' && currentSlide.background.value && (
          <img
            src={currentSlide.background.value}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Elements */}
        {currentSlide?.elements?.map(element => renderElement(element))}

        {/* Navigation overlay */}
        <div className="absolute inset-0 flex">
          <button
            className="flex-1 cursor-pointer"
            onClick={handlePrevSlide}
            disabled={currentSlideIndex === 0}
          />
          <button
            className="flex-1 cursor-pointer"
            onClick={handleNextSlide}
            disabled={currentSlideIndex === storyData.slides.length - 1}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <Button
          size="sm"
          variant="secondary"
          onClick={handlePrevSlide}
          disabled={currentSlideIndex === 0}
          className="bg-black/20 text-white border-0 hover:bg-black/40"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={togglePlay}
            className="bg-black/20 text-white border-0 hover:bg-black/40"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <span className="text-white text-sm bg-black/20 px-2 py-1 rounded">
            {currentSlideIndex + 1} / {storyData.slides.length}
          </span>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={handleNextSlide}
          disabled={currentSlideIndex === storyData.slides.length - 1}
          className="bg-black/20 text-white border-0 hover:bg-black/40"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (trigger) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className={`${isFullscreen ? 'w-screen h-screen max-w-none' : 'max-w-md'} p-6`}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Предпросмотр Stories</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className={`flex items-center justify-center ${isFullscreen ? 'flex-1' : 'py-4'}`}>
            {renderStoryFrame()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center justify-center py-4">
      {renderStoryFrame()}
    </div>
  );
}