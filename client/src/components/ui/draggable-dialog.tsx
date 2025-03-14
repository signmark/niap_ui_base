import React, { useRef, useState, ComponentProps, forwardRef } from "react"
import Draggable from "react-draggable"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface DraggableDialogContentProps
  extends ComponentProps<typeof DialogContent> {
  onResizeStart?: () => void
  onResizeEnd?: () => void
}

export const DraggableDialogContent = forwardRef<
  HTMLDivElement,
  DraggableDialogContentProps
>(({ className, children, onResizeStart, onResizeEnd, ...props }, ref) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)

  const [size, setSize] = useState({
    width: 800,
    height: 600,
  })

  const onStart = () => {
    setIsDragging(true)
  }

  const onStop = () => {
    setIsDragging(false)
  }

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsResizing(true)
    if (onResizeStart) onResizeStart()

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX)
      const newHeight = startHeight + (moveEvent.clientY - startY)
      
      setSize({
        width: Math.max(600, newWidth), // Минимальная ширина 600px
        height: Math.max(400, newHeight), // Минимальная высота 400px
      })
    }

    const handleResizeEnd = () => {
      setIsResizing(false)
      if (onResizeEnd) onResizeEnd()
      window.removeEventListener("mousemove", handleResizeMove)
      window.removeEventListener("mouseup", handleResizeEnd)
    }

    window.addEventListener("mousemove", handleResizeMove)
    window.addEventListener("mouseup", handleResizeEnd)
  }

  return (
    <Draggable
      handle=".draggable-header"
      bounds="body"
      onStart={onStart}
      onStop={onStop}
      nodeRef={dialogRef}
      disabled={isResizing}
    >
      <DialogContent
        ref={dialogRef}
        className={cn(
          "cursor-auto resize-none",
          isDragging && "cursor-grabbing",
          isResizing && "resize-none transition-none",
          className
        )}
        style={{
          width: size.width,
          height: size.height,
          maxWidth: "95vw",
          maxHeight: "90vh",
          position: "fixed",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          padding: 0,
          overflow: "hidden",
          backgroundColor: "white"
        }}
        {...props}
      >
        <div className="flex flex-col h-full">
          {children}
        </div>
        
        {/* Resize handle */}
        <div 
          ref={resizeHandleRef}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-50"
          onMouseDown={handleResizeStart}
          style={{
            background: "transparent",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
            touchAction: "none"
          }}
        >
          <svg 
            width="10" 
            height="10" 
            viewBox="0 0 10 10"
            className="absolute bottom-1 right-1"
          >
            <path 
              d="M0 10L10 0L10 10L0 10Z" 
              fill="rgba(0,0,0,0.3)" 
            />
          </svg>
        </div>
      </DialogContent>
    </Draggable>
  )
})

DraggableDialogContent.displayName = "DraggableDialogContent"

export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}