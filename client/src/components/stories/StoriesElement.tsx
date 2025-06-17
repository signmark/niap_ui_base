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

export function StoriesElement({
  element,
  isSelected,
  isPreview = false,
  onClick,
  onUpdate,
  onDelete
}: StoriesElementProps) {
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
              fontSize: `${element.style?.fontSize || 16}px`,
              color: element.style?.color || '#000000',
              fontWeight: element.style?.fontWeight || 'normal',
              textAlign: element.style?.textAlign as any || 'left',
              fontFamily: element.style?.fontFamily || 'Arial',
              textShadow: element.style?.textShadow || 'none',
              backgroundColor: element.style?.backgroundColor || 'transparent',
              padding: element.style?.padding || '8px',
              borderRadius: element.style?.borderRadius || '0px',
              border: element.style?.border || 'none',
              textDecoration: element.style?.textDecoration || 'none'
            }}
            className="pointer-events-none select-none whitespace-pre-wrap"
          >
            {element.content || 'Введите текст'}
          </div>
        );
      
      case 'image':
        return (
          <img
            src={element.content || 'https://placehold.co/200x200?text=Image'}
            alt="Story element"
            className="max-w-full max-h-full object-contain pointer-events-none select-none"
            style={{
              width: element.style?.width || 'auto',
              height: element.style?.height || 'auto',
              borderRadius: element.style?.borderRadius || '0px',
              border: element.style?.border || 'none',
              filter: element.style?.filter || 'none',
              opacity: element.style?.opacity || 1
            }}
          />
        );
      
      case 'shape':
        return (
          <div
            className="pointer-events-none select-none"
            style={{
              width: element.style?.width || '100px',
              height: element.style?.height || '100px',
              backgroundColor: element.style?.backgroundColor || '#000000',
              borderRadius: element.style?.borderRadius || '0px',
              border: element.style?.border || 'none',
              opacity: element.style?.opacity || 1
            }}
          />
        );
      
      default:
        return <div>Unknown element type</div>;
    }
  };

  const elementStyle = {
    position: 'absolute' as const,
    left: element.position.x,
    top: element.position.y,
    zIndex: element.style?.zIndex || 1,
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
        style={elementStyle}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`group ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      >
        {getElementContent()}
        
        {/* Controls overlay */}
        {isSelected && !isPreview && (
          <div className="absolute -top-8 -right-2 flex gap-1 bg-white rounded shadow-lg border p-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
}

export default StoriesElement;