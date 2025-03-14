import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TransparentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
}

export function TransparentDialog({
  isOpen,
  onClose,
  title,
  children,
  className,
  initialWidth = 800,
  initialHeight = 600,
  minWidth = 400,
  minHeight = 300
}: TransparentDialogProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // Центрирование диалога при открытии
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const dialogWidth = initialWidth;
      const dialogHeight = initialHeight;
      
      setPosition({
        x: (windowWidth - dialogWidth) / 2,
        y: (windowHeight - dialogHeight) / 2
      });
    }
  }, [isOpen, initialWidth, initialHeight]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 overflow-hidden flex items-center justify-center"
      onClick={(e) => {
        // Закрываем диалог только при клике непосредственно на backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Draggable
        handle=".drag-handle"
        position={position}
        onStop={(e, data) => {
          setPosition({ x: data.x, y: data.y });
        }}
        bounds="parent"
      >
        <div 
          ref={dialogRef}
          className={cn(
            "bg-background rounded-lg shadow-lg overflow-hidden flex flex-col",
            className
          )}
          style={{ 
            width: initialWidth, 
            height: initialHeight,
            minWidth,
            minHeight
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drag-handle flex justify-between items-center px-4 py-2 bg-muted cursor-move border-b">
            <h2 className="text-lg font-medium">{title}</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            {children}
          </div>
        </div>
      </Draggable>
    </div>
  );
}