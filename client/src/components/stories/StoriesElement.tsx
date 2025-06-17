import React from 'react';
import { StoryElement } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, Type, Image, Square } from 'lucide-react';
import Draggable from 'react-draggable';

interface StoriesElementProps {
  element: StoryElement;
  isSelected: boolean;
  isPreview?: boolean;
  onClick: () => void;
  onUpdate: (elementId: string, updates: Partial<StoryElement>) => void;
  onDelete: (elementId: string) => void;
}

const StoriesElement: React.FC<StoriesElementProps> = ({
  element,
  isSelected,
  isPreview = false,
  onClick,
  onUpdate,
  onDelete
}) => {
  const handleDrag = (e: any, data: any) => {
    if (isPreview) return;
    
    onUpdate(element.id, {
      position: {
        x: data.x,
        y: data.y
      }
    });
  };

  const getElementContent = () => {
    switch (element.type) {
      case 'text':
        return (
          <div
            style={{
              fontSize: element.style?.fontSize || 16,
              color: element.style?.color || '#000000',
              fontWeight: element.style?.fontWeight || 'normal',
              textAlign: (element.style?.textAlign as any) || 'left',
              padding: '4px',
              background: element.style?.backgroundColor || 'transparent',
              borderRadius: '4px',
              maxWidth: '200px',
              wordBreak: 'break-word'
            }}
          >
            {element.content || 'Текст'}
          </div>
        );
      case 'image':
        return (
          <div
            style={{
              width: element.style?.width || 100,
              height: element.style?.height || 100,
              border: '2px dashed #ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              backgroundColor: '#f9f9f9'
            }}
          >
            {element.content ? (
              <img
                src={element.content}
                alt="Story element"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '4px'
                }}
              />
            ) : (
              <Image className="h-6 w-6 text-gray-400" />
            )}
          </div>
        );
      case 'shape':
        return (
          <div
            style={{
              width: element.style?.width || 50,
              height: element.style?.height || 50,
              backgroundColor: element.style?.backgroundColor || '#3b82f6',
              borderRadius: element.style?.borderRadius || '4px',
              border: `2px solid ${element.style?.borderColor || 'transparent'}`
            }}
          />
        );
      default:
        return null;
    }
  };

  const elementStyle = {
    position: 'absolute' as const,
    left: element.position.x,
    top: element.position.y,
    zIndex: Math.min(element.style?.zIndex || 1, 10), // Ограничиваем максимальный z-index
    cursor: isPreview ? 'default' : 'move',
    transform: `rotate(${element.style?.rotation || 0}deg)`,
    transformOrigin: 'center'
  };

  if (isPreview) {
    return (
      <div style={elementStyle}>
        {getElementContent()}
      </div>
    );
  }

  return (
    <Draggable
      position={{ x: element.position.x, y: element.position.y }}
      onDrag={handleDrag}
      disabled={isPreview}
    >
      <div
        className={`group relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
        onClick={onClick}
        style={{
          cursor: isPreview ? 'default' : 'move',
          transform: `rotate(${element.style?.rotation || 0}deg)`,
          transformOrigin: 'center'
        }}
      >
        {getElementContent()}
        
        {/* Controls overlay */}
        {isSelected && !isPreview && (
          <div className="absolute -top-8 -right-2 flex gap-1 bg-white rounded shadow-lg border p-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(element.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default StoriesElement;