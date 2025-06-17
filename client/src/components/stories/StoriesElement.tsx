import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Move } from 'lucide-react';
import type { StoryElement } from '@/types';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(element.content);

  const handleContentEdit = () => {
    if (element.type === 'text') {
      setIsEditing(true);
      setEditValue(element.content);
    }
  };

  const handleContentSave = () => {
    onUpdate(element.id, { content: editValue });
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleContentSave();
    } else if (e.key === 'Escape') {
      setEditValue(element.content);
      setIsEditing(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isPreview) return;
    e.dataTransfer.setData('text/plain', element.id);
  };

  const renderElementContent = () => {
    switch (element.type) {
      case 'text':
        if (isEditing && !isPreview) {
          return (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleContentSave}
              onKeyDown={handleKeyPress}
              className="bg-transparent border-none p-0 text-inherit text-center"
              style={{ fontSize: element.style?.fontSize || 24 }}
              autoFocus
            />
          );
        }
        return (
          <div
            onDoubleClick={handleContentEdit}
            className={`${!isPreview ? 'cursor-text' : ''}`}
            style={{
              fontSize: element.style?.fontSize || 24,
              color: element.style?.color || '#ffffff',
              fontFamily: element.style?.fontFamily || 'inherit',
              fontWeight: element.style?.fontWeight || 'bold',
              textAlign: element.style?.textAlign || 'center',
              backgroundColor: element.style?.backgroundColor || 'transparent',
              borderRadius: element.style?.borderRadius || 0,
              padding: element.style?.backgroundColor ? '8px' : '0',
              opacity: element.style?.opacity || 1
            }}
          >
            {element.content || 'Текст'}
          </div>
        );

      case 'image':
        return (
          <div
            className="w-full h-full bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 text-sm"
            style={{ borderRadius: element.style?.borderRadius || 8 }}
          >
            {element.content ? (
              <img 
                src={element.content} 
                alt="Story image" 
                className="w-full h-full object-cover"
                style={{ borderRadius: element.style?.borderRadius || 8 }}
              />
            ) : (
              'Фото'
            )}
          </div>
        );

      case 'sticker':
        return (
          <div className="w-full h-full bg-yellow-200 border-2 border-yellow-400 rounded-full flex items-center justify-center text-yellow-800 text-sm font-bold">
            {element.content || '😊'}
          </div>
        );

      case 'poll':
        return (
          <div className="w-full h-full bg-blue-100 border-2 border-blue-400 rounded-lg p-2 text-blue-800 text-xs">
            <div className="font-bold mb-1">Опрос</div>
            <div className="text-xs">{element.content || 'Ваш вопрос'}</div>
          </div>
        );

      case 'question':
        return (
          <div className="w-full h-full bg-purple-100 border-2 border-purple-400 rounded-lg p-2 text-purple-800 text-xs">
            <div className="font-bold mb-1">Вопрос</div>
            <div className="text-xs">{element.content || 'Задайте вопрос'}</div>
          </div>
        );

      case 'countdown':
        return (
          <div className="w-full h-full bg-red-100 border-2 border-red-400 rounded-lg p-2 text-red-800 text-xs">
            <div className="font-bold mb-1">Таймер</div>
            <div className="text-xs">{element.content || '00:00:00'}</div>
          </div>
        );

      default:
        return (
          <div className="w-full h-full bg-gray-200 border-2 border-gray-400 rounded p-2 text-gray-600 text-xs">
            {element.type}
          </div>
        );
    }
  };

  return (
    <div
      className={`absolute cursor-pointer group ${
        isSelected && !isPreview ? 'ring-2 ring-blue-500' : ''
      }`}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.width,
        height: element.size.height,
        transform: `rotate(${element.rotation}deg)`,
        zIndex: isSelected ? 10 : 1
      }}
      onClick={onClick}
      draggable={!isPreview}
      onDragStart={handleDragStart}
    >
      {renderElementContent()}

      {/* Элементы управления (только в режиме редактирования) */}
      {isSelected && !isPreview && (
        <>
          {/* Кнопка удаления */}
          <Button
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>

          {/* Индикатор перемещения */}
          <div className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Move className="h-3 w-3 text-white" />
          </div>

          {/* Маркеры изменения размера */}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity" />
        </>
      )}
    </div>
  );
}