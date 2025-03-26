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
  
  // Функция для определения URL для каждого типа аккордеона
  const getFullscreenUrl = (): string | null => {
    if (!value || !campaignId || !expandablePages[value]) return null;
    return `${expandablePages[value]}?campaignId=${campaignId}`;
  };
  
  // Проверяем, имеет ли аккордеон соответствующую полноэкранную страницу
  const hasFullscreenPage = value && expandablePages[value] !== undefined;
  
  return (
    <AccordionPrimitive.Header className="flex">
      <div className="flex flex-1 items-center">
        <AccordionPrimitive.Trigger
          ref={ref}
          className={cn(
            "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline",
            className
          )}
          {...props}
        >
          <span>{children}</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-2 [&[data-state=open]>svg]:rotate-180" />
        </AccordionPrimitive.Trigger>
        
        {/* Кнопка для развёртывания на полный экран */}
        {hasFullscreenPage && (
          <button 
            type="button"
            className="ml-2 p-2 flex items-center cursor-pointer text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.preventDefault();
              const url = getFullscreenUrl();
              if (url) {
                setLocation(url);
              }
            }}
            title="Открыть на полном экране"
            aria-label="Открыть на полном экране"
          >
            <Maximize className="h-4 w-4" />
          </button>
        )}
      </div>
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
