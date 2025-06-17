import React from 'react';
import { StorySlide, StoryElement } from '@/types';

interface StoriesCanvasProps {
  slide: StorySlide;
  selectedElement: string | null;
  onElementSelect: (elementId: string) => void;
  onElementUpdate: (elementId: string, updates: Partial<StoryElement>) => void;
  onElementAdd: (elementType: StoryElement['type']) => void;
  onElementDelete: (elementId: string) => void;
  isPreview?: boolean;
}

export function StoriesCanvas({
  slide,
  selectedElement,
  onElementSelect,
  onElementUpdate,
  onElementAdd,
  onElementDelete,
  isPreview = false
}: StoriesCanvasProps) {
  const canvasStyle = {
    width: '180px', // Smaller 9:16 aspect ratio (180x320)
    height: '320px',
    backgroundColor: slide.background?.color || '#ffffff',
    backgroundImage: slide.background?.image ? `url(${slide.background.image})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    position: 'relative' as const,
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    margin: '0 auto'
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onElementSelect('');
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Canvas */}
      <div 
        style={canvasStyle}
        onClick={handleCanvasClick}
        className="cursor-default"
      >
        {slide.elements.map((element) => (
          <div
            key={element.id}
            className={`absolute cursor-pointer ${
              selectedElement === element.id ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              left: `${element.position.x}px`,
              top: `${element.position.y}px`,
              width: `${element.size.width}px`,
              height: `${element.size.height}px`,
              zIndex: 10
            }}
            onClick={(e) => {
              e.stopPropagation();
              onElementSelect(element.id);
            }}
          >
            {element.type === 'text' && (
              <div
                style={{
                  fontSize: `${element.style?.fontSize || 16}px`,
                  color: element.style?.color || '#000000',
                  backgroundColor: element.style?.backgroundColor || 'transparent',
                  padding: '4px',
                  borderRadius: `${element.style?.borderRadius || 0}px`,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {element.content || 'Текст'}
              </div>
            )}
            {element.type === 'image' && (
              <img
                src={element.content || 'https://placehold.co/100x100?text=Img'}
                alt="Element"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: `${element.style?.borderRadius || 0}px`
                }}
              />
            )}
            {element.type === 'shape' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: element.style?.backgroundColor || '#6366f1',
                  borderRadius: `${element.style?.borderRadius || 8}px`
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}