import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown, Maximize } from "lucide-react"
import { useLocation } from "wouter"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

// Маппинг значений аккордеонов на URL страниц
const expandablePages: Record<string, string> = {
  'keywords': '/keywords',
  'trends': '/trends',
  'content': '/content',
  'social-media': '/social-media-settings',
  'schedule': '/schedule'
};

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & { 
    campaignId?: string;
    value: string;
  }
>(({ className, campaignId, value, ...props }, ref) => {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn("border-b", className)}
      value={value}
      {...props}
    />
  );
})
AccordionItem.displayName = "AccordionItem"

interface AccordionTriggerProps extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {
  value?: string;
  campaignId?: string;
}

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({ className, children, value, campaignId, ...props }, ref) => {
  // Используем wouter hook для навигации
  const [_, setLocation] = useLocation();
  
  // Проверяем, имеет ли аккордеон соответствующую полноэкранную страницу
  const hasFullscreenPage = value && expandablePages[value] !== undefined;
  
  // Функция для перехода на полноэкранную страницу
  const navigateToFullscreen = () => {
    if (!value || !campaignId || !expandablePages[value]) return;
    const url = `${expandablePages[value]}?campaignId=${campaignId}`;
    setLocation(url);
  };
  
  return (
    <AccordionPrimitive.Header className="flex relative">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline",
          className
        )}
        {...props}
      >
        {children}
        <div className="flex items-center gap-2">
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
        </div>
      </AccordionPrimitive.Trigger>
      
      {/* Separate fullscreen button */}
      {hasFullscreenPage && (
        <div 
          className="absolute right-10 top-1/2 -translate-y-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="p-2 flex items-center cursor-pointer text-muted-foreground hover:text-primary"
            onClick={navigateToFullscreen}
            title="Открыть на полном экране"
            aria-label="Открыть на полном экране"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      )}
    </AccordionPrimitive.Header>
  );
})
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
