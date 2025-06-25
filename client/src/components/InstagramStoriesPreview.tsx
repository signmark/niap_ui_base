import React, { useState, useEffect } from 'react';
import { PlayCircle, MoreHorizontal, Pause, Play } from 'lucide-react';

interface StoriesPreviewProps {
  metadata: any;
}

export const InstagramStoriesPreview: React.FC<StoriesPreviewProps> = ({ metadata }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Parse metadata safely
  let parsedData;
  try {
    parsedData = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
  } catch (e) {
    return (
      <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center">
        <p className="text-red-800">Ошибка при загрузке данных Stories</p>
      </div>
    );
  }

  const slides = parsedData?.slides || [];
  
  if (slides.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Нет слайдов для отображения</p>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];
  const slidesDuration = 5000; // 5 seconds per slide

  // Auto advance slides
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setCurrentSlideIndex(prevIndex => 
            prevIndex >= slides.length - 1 ? 0 : prevIndex + 1
          );
          return 0;
        }
        return prev + (100 / (slidesDuration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, slides.length, currentSlideIndex]);

  // Reset progress when slide changes
  useEffect(() => {
    setProgress(0);
  }, [currentSlideIndex]);

  const handleSlideClick = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      setCurrentSlideIndex(prev => prev >= slides.length - 1 ? 0 : prev + 1);
    } else {
      setCurrentSlideIndex(prev => prev <= 0 ? slides.length - 1 : prev - 1);
    }
    setProgress(0);
  };
  
  return (
    <div className="flex justify-center">
      <div 
        className="bg-black rounded-2xl overflow-hidden relative cursor-pointer select-none"
        style={{ width: '280px', height: '497px' }}
        onMouseEnter={() => setIsPlaying(false)}
        onMouseLeave={() => setIsPlaying(true)}
      >
        {/* Instagram Stories Container */}
        <div className="relative w-full h-full">
          
          {/* Click areas for navigation */}
          <div 
            className="absolute left-0 top-0 w-1/2 h-full z-30"
            onClick={() => handleSlideClick('prev')}
          />
          <div 
            className="absolute right-0 top-0 w-1/2 h-full z-30"
            onClick={() => handleSlideClick('next')}
          />

          {/* Background */}
          <div className="absolute inset-0">
            {currentSlide.background?.type === 'image' && currentSlide.background.value ? (
              <img 
                src={currentSlide.background.value} 
                alt="Background" 
                className="w-full h-full object-cover"
              />
            ) : currentSlide.background?.type === 'color' && 
                 currentSlide.background.value?.startsWith && 
                 currentSlide.background.value.startsWith('#') ? (
              <div 
                className="w-full h-full"
                style={{ backgroundColor: currentSlide.background.value }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-500 to-red-500" />
            )}
          </div>
          
          {/* Instagram Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-3">
            {/* Progress bars */}
            <div className="flex gap-1 mb-3">
              {slides.map((_, index) => (
                <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-100"
                    style={{
                      width: index < currentSlideIndex ? '100%' : 
                             index === currentSlideIndex ? `${progress}%` : '0%'
                    }}
                  />
                </div>
              ))}
            </div>
            
            {/* User info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 p-0.5">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                    <span className="text-xs">📱</span>
                  </div>
                </div>
                <span className="text-white text-sm font-medium">your_account</span>
                <span className="text-white/60 text-xs">5м</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(!isPlaying);
                  }}
                  className="p-1"
                >
                  {isPlaying ? 
                    <Pause className="w-5 h-5 text-white" /> : 
                    <Play className="w-5 h-5 text-white" />
                  }
                </button>
                <MoreHorizontal className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
          
          {/* Story Elements */}
          {currentSlide.elements?.map((element: any, index: number) => {
            const position = element.position || { x: 50, y: 50, width: 100, height: 50 };
            
            return (
              <div
                key={`${currentSlideIndex}-${index}`}
                className="absolute animate-fadeIn"
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: `${position.width}px`,
                  height: `${position.height}px`,
                  transform: `rotate(${element.rotation || 0}deg)`,
                  zIndex: element.zIndex || 10,
                }}
              >
                {/* Text Element */}
                {element.type === 'text' && (
                  <div 
                    className="text-white font-bold flex items-center justify-center h-full p-2"
                    style={{
                      fontSize: `${element.content?.fontSize || element.style?.fontSize || 16}px`,
                      color: element.style?.color || element.content?.color || '#ffffff',
                      fontFamily: element.style?.fontFamily || 'Arial',
                      fontWeight: element.style?.fontWeight || 'bold',
                      textAlign: element.style?.textAlign || 'center',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      wordWrap: 'break-word',
                      overflow: 'hidden',
                      lineHeight: '1.2'
                    }}
                  >
                    {element.content?.text || 'Текст'}
                  </div>
                )}
                
                {/* Image Element */}
                {element.type === 'image' && element.content?.url && (
                  <img 
                    src={element.content.url} 
                    alt={element.content.alt || 'Image'}
                    className="w-full h-full object-cover shadow-lg"
                    style={{
                      borderRadius: `${element.style?.borderRadius || 8}px`
                    }}
                  />
                )}
                
                {/* Poll Element */}
                {element.type === 'poll' && (
                  <div 
                    className="bg-white/95 backdrop-blur p-3 shadow-lg text-black w-full"
                    style={{
                      backgroundColor: element.style?.backgroundColor?.startsWith('#') ? element.style.backgroundColor : 'rgba(255, 255, 255, 0.95)',
                      borderRadius: `${element.style?.borderRadius || 12}px`,
                    }}
                  >
                    <div className="font-bold mb-3 text-center text-sm">
                      {element.content?.question || 'Вопрос опроса'}
                    </div>
                    {element.content?.options?.slice(0, 2).map((option: string, optIdx: number) => (
                      <div 
                        key={optIdx} 
                        className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-2 mb-2 text-center text-xs cursor-pointer hover:from-blue-200 hover:to-purple-200 transition-all"
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Slide indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-black/50 backdrop-blur rounded-full px-3 py-1">
              <span className="text-white text-xs">
                {currentSlideIndex + 1} / {slides.length}
              </span>
            </div>
          </div>
          
          {/* Bottom gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent z-5"></div>
        </div>
      </div>
    </div>
  );
};

export default InstagramStoriesPreview;