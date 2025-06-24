import React from 'react';
import { PlayCircle, MoreHorizontal } from 'lucide-react';

interface StoriesPreviewProps {
  metadata: any;
}

export const InstagramStoriesPreview: React.FC<StoriesPreviewProps> = ({ metadata }) => {
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

  // Show first slide for preview
  const firstSlide = slides[0];
  
  return (
    <div className="flex justify-center">
      <div className="bg-black rounded-2xl overflow-hidden" style={{ width: '280px', height: '497px' }}>
        {/* Instagram Stories Container */}
        <div className="relative w-full h-full bg-gradient-to-br from-purple-600 via-pink-500 to-red-500">
          
          {/* Instagram Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-3">
            {/* Progress bars */}
            <div className="flex gap-1 mb-3">
              {slides.map((_, index) => (
                <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-white rounded-full transition-all duration-300 ${
                      index === 0 ? 'w-full' : 'w-0'
                    }`} 
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
                <PlayCircle className="w-5 h-5 text-white" />
                <MoreHorizontal className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          {/* Background */}
          {firstSlide.background?.type === 'image' && firstSlide.background.value && (
            <img 
              src={firstSlide.background.value} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          
          {/* Story Elements */}
          {firstSlide.elements?.map((element: any, index: number) => {
            const position = element.position || { x: 50, y: 50, width: 100, height: 50 };
            
            return (
              <div
                key={index}
                className="absolute"
                style={{
                  left: `${Math.max(0, Math.min(100, position.x / 280 * 100))}%`,
                  top: `${Math.max(0, Math.min(100, position.y / 497 * 100))}%`,
                  width: `${Math.max(10, Math.min(80, position.width / 280 * 100))}%`,
                  height: `${Math.max(5, Math.min(50, position.height / 497 * 100))}%`,
                  transform: `rotate(${element.rotation || 0}deg)`,
                  zIndex: element.zIndex || 10,
                }}
              >
                {/* Text Element */}
                {element.type === 'text' && (
                  <div 
                    className="text-white font-bold text-center flex items-center justify-center h-full"
                    style={{
                      fontSize: `${Math.max(12, Math.min(24, element.content?.fontSize || 16))}px`,
                      color: element.style?.color || '#ffffff',
                      fontFamily: element.style?.fontFamily || 'Arial',
                      fontWeight: element.style?.fontWeight || 'bold',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      wordWrap: 'break-word',
                      overflow: 'hidden'
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
                    className="w-full h-full object-cover rounded-lg shadow-lg"
                    style={{
                      borderRadius: `${element.style?.borderRadius || 8}px`
                    }}
                  />
                )}
                
                {/* Poll Element */}
                {element.type === 'poll' && (
                  <div 
                    className="bg-white/95 backdrop-blur rounded-xl p-3 shadow-lg text-black text-xs"
                    style={{
                      backgroundColor: element.style?.backgroundColor || 'rgba(255, 255, 255, 0.95)',
                      borderRadius: `${element.style?.borderRadius || 12}px`,
                    }}
                  >
                    <div className="font-bold mb-2 text-center">
                      {element.content?.question || 'Вопрос опроса'}
                    </div>
                    {element.content?.options?.slice(0, 2).map((option: string, optIdx: number) => (
                      <div key={optIdx} className="bg-gray-100 rounded-lg p-2 mb-1 text-center">
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Bottom gradient overlay for better readability */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent z-5"></div>
        </div>
      </div>
    </div>
  );
};

export default InstagramStoriesPreview;