import React, { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import StoryElement from './StoryElement';

interface StorySlide {
  id: string;
  order: number;
  duration: number;
  background: {
    type: 'color' | 'image' | 'video';
    value: string;
  };
  elements: StoryElementType[];
}

interface StoryElementType {
  id: string;
  type: 'text' | 'image' | 'video' | 'poll' | 'quiz';
  position: { x: number; y: number };
  rotation: number;
  zIndex: number;
  content: any;
  style?: any;
}
import { Trash2, RotateCw, Move, Square } from 'lucide-react';

interface StoryCanvasProps {
  slide?: StorySlide;
  storyId?: string;
  onSlideUpdate: () => void;
}

interface DragState {
  isDragging: boolean;
  elementId: string | null;
  startX: number;
  startY: number;
  startElementX: number;
  startElementY: number;
}

export default function StoryCanvas({ slide, storyId, onSlideUpdate }: StoryCanvasProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    elementId: null,
    startX: 0,
    startY: 0,
    startElementX: 0,
    startElementY: 0
  });

  // Update element mutation
  const updateElementMutation = useMutation({
    mutationFn: ({ elementId, data }: { elementId: string; data: any }) =>
      apiRequest(`/api/stories/${storyId}/slides/${slide?.id}/elements/${elementId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      onSlideUpdate();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка обновления',
        description: error.message || 'Не удалось обновить элемент',
        variant: 'destructive'
      });
    }
  });

  // Delete element mutation
  const deleteElementMutation = useMutation({
    mutationFn: (elementId: string) =>
      apiRequest(`/api/stories/${storyId}/slides/${slide?.id}/elements/${elementId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      setSelectedElementId(null);
      onSlideUpdate();
      toast({
        title: 'Элемент удален',
        description: 'Элемент успешно удален'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка удаления',
        description: error.message || 'Не удалось удалить элемент',
        variant: 'destructive'
      });
    }
  });

  const handleMouseDown = useCallback((e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const element = slide?.elements?.find(el => el.id === elementId);
    if (!element) return;

    setSelectedElementId(elementId);
    setDragState({
      isDragging: true,
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      startElementX: element.position.x,
      startElementY: element.position.y
    });
  }, [slide?.elements]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.elementId) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;
    
    const newX = Math.max(0, Math.min(1080 - 100, dragState.startElementX + deltaX * 2)); // Scale for canvas
    const newY = Math.max(0, Math.min(1920 - 100, dragState.startElementY + deltaY * 3.56)); // 9:16 ratio scaling

    const element = slide?.elements?.find(el => el.id === dragState.elementId);
    if (!element) return;

    // Update element position optimistically
    const updatedPosition = {
      ...element.position,
      x: newX,
      y: newY
    };

    updateElementMutation.mutate({
      elementId: dragState.elementId,
      data: { position: updatedPosition }
    });
  }, [dragState, slide?.elements, updateElementMutation]);

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      elementId: null,
      startX: 0,
      startY: 0,
      startElementX: 0,
      startElementY: 0
    });
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // If clicking on canvas background, deselect elements
    if (e.target === e.currentTarget) {
      setSelectedElementId(null);
    }
  }, []);

  const handleDeleteElement = () => {
    if (selectedElementId) {
      deleteElementMutation.mutate(selectedElementId);
    }
  };

  const getBackgroundStyle = (background: any): React.CSSProperties => {
    if (!background) return { backgroundColor: '#ffffff' };

    switch (background.type) {
      case 'color':
        return { backgroundColor: background.value };
      case 'gradient':
        if (background.value.type === 'linear') {
          const angle = background.value.angle || 0;
          const colors = background.value.colors?.join(', ') || '#ffffff, #000000';
          return { background: `linear-gradient(${angle}deg, ${colors})` };
        } else if (background.value.type === 'radial') {
          const colors = background.value.colors?.join(', ') || '#ffffff, #000000';
          return { background: `radial-gradient(circle, ${colors})` };
        }
        break;
      case 'image':
        return {
          backgroundImage: `url(${background.value.url})`,
          backgroundSize: background.value.fit || 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        };
      case 'video':
        return { backgroundColor: '#000000' };
      default:
        return { backgroundColor: '#ffffff' };
    }
    return { backgroundColor: '#ffffff' };
  };

  const renderElement = (element: StoryElement) => {
    const isSelected = selectedElementId === element.id;
    
    const elementStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${(element.position.x / 1080) * 100}%`,
      top: `${(element.position.y / 1920) * 100}%`,
      width: `${(element.position.width / 1080) * 100}%`,
      height: `${(element.position.height / 1920) * 100}%`,
      transform: `rotate(${element.rotation}deg)`,
      zIndex: element.zIndex,
      cursor: 'move',
      border: isSelected ? '2px solid #3b82f6' : '1px solid transparent',
      borderRadius: '2px',
      ...element.style
    };

    let elementContent = null;

    switch (element.type) {
      case 'text':
        elementContent = (
          <div
            className="w-full h-full flex items-center justify-center p-2 text-center"
            style={{
              fontSize: element.style?.fontSize || 16,
              fontFamily: element.style?.fontFamily || 'Arial',
              fontWeight: element.style?.fontWeight || 'normal',
              fontStyle: element.style?.fontStyle || 'normal',
              textAlign: element.style?.textAlign || 'center',
              color: element.style?.color || '#000000',
              backgroundColor: element.style?.backgroundColor || 'transparent',
              textShadow: element.style?.textShadow || 'none'
            }}
          >
            {element.content?.text || 'Текст'}
          </div>
        );
        break;
      
      case 'image':
        elementContent = (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
            {element.content?.url ? (
              <img 
                src={element.content.url} 
                alt="" 
                className="w-full h-full object-cover"
              />
            ) : (
              'Изображение'
            )}
          </div>
        );
        break;
      
      case 'sticker':
        elementContent = (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {element.content?.emoji || '😀'}
          </div>
        );
        break;
      
      default:
        elementContent = (
          <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">
            {element.type}
          </div>
        );
    }

    return (
      <div
        key={element.id}
        style={elementStyle}
        onMouseDown={(e) => handleMouseDown(e, element.id)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedElementId(element.id);
        }}
        className="group"
      >
        {elementContent}
        
        {/* Selection handles */}
        {isSelected && (
          <>
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
          </>
        )}
      </div>
    );
  };

  if (!slide) {
    return (
      <Card className="w-80 h-[568px] bg-gray-100">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Square className="w-8 h-8 mx-auto mb-2" />
            <p>Выберите слайд для редактирования</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Canvas */}
      <Card className="w-80 h-[568px] overflow-hidden shadow-lg">
        <CardContent className="p-0 h-full">
          <div
            ref={canvasRef}
            className="relative w-full h-full"
            style={getBackgroundStyle(slide.background)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleCanvasClick}
          >
            {/* Grid overlay (optional) */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #000 1px, transparent 1px),
                  linear-gradient(to bottom, #000 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }}
            />

            {/* Render elements */}
            {slide.elements?.map(renderElement)}
            
            {/* Canvas info overlay */}
            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              9:16 • {slide.duration}s
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Element controls */}
      {selectedElementId && (
        <Card className="w-80">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                Выбранный элемент
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteElement}
                  disabled={deleteElementMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}