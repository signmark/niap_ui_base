import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown, ExternalLink } from "lucide-react"
import { useLocation } from "wouter"

import { cn } from "@/lib/utils"

// Модифицированный Accordion
const Accordion = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ children, ...props }, ref) => {
  return (
    <AccordionPrimitive.Root 
      ref={ref}
      {...props} 
      className={cn(props.className)}
    >
      {children}
    </AccordionPrimitive.Root>
  );
});

// Маппинг значений аккордеонов на URL страниц
const expandablePages: Record<string, string> = {
  'site': '/site',
  'business-questionnaire': '/business-questionnaire',
  'trend-analysis': '/trend-analysis',
  'trends': '/trends',
  'content': '/content',
  'social-media': '/social-media-settings',
  'calendar': '/schedule'
};

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & { 
    campaignId?: string;
    value: string; // value должно быть обязательным для корректной работы
  }
>(({ className, campaignId, value, ...props }, ref) => {
  // Создаем копию props для передачи радиксу
  const itemProps = { ...props };
  
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        "border-b", 
        className
      )}
      data-campaign-id={campaignId}
      data-value={value}
      value={value}
      // Передаем все свойства, кроме наших кастомных
      {...itemProps}
    />
  );
})
AccordionItem.displayName = "AccordionItem"

// Функция для определения URL для каждого типа аккордеона
const getFullscreenUrl = (value: string | null, campaignId?: string | null): string | null => {
  // По умолчанию аккордеон не имеет страницы для расширения
  if (!value || !campaignId || !expandablePages[value]) return null;
  
  return `${expandablePages[value]}?campaignId=${campaignId}`;
};

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    value?: string;
    campaignId?: string;
  }
>(({ className, children, value, campaignId, ...props }, ref) => {
  // Используем wouter hook для навигации
  const [_, setLocation] = useLocation();
  
  // Обработчик клика по кнопке "Открыть в новой странице"
  const handleFullscreenPage = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем срабатывание триггера аккордеона
    
    if (value && campaignId) {
      const url = getFullscreenUrl(value, campaignId);
      console.log('Navigating to URL:', url, 'for value:', value, 'campaignId:', campaignId);
      
      if (url) {
        // Используем wouter для навигации вместо window.location
        setLocation(url);
      }
    }
  };
  
  // Функция для проверки, имеет ли аккордеон соответствующую полноэкранную страницу
  const hasFullscreenPage = (): boolean => {
    if (!value) {
      console.log('hasFullscreenPage: value is undefined or not passed');
      return false;
    }
    
    const hasPage = Boolean(expandablePages[value] !== undefined);
    console.log('Checking fullscreen page for value:', value, 'exists:', hasPage);
    return hasPage;
  };
  
  return (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <div className="flex items-center gap-2">
        {/* Кнопка для перехода на полноэкранную страницу - показываем только если есть страница */}
        {hasFullscreenPage() && (
          <div 
            className="flex items-center cursor-pointer text-muted-foreground hover:text-primary"
            onClick={handleFullscreenPage}
            title="Открыть на полном экране"
            aria-label="Открыть на полном экране"
          >
            <ExternalLink className="h-4 w-4" />
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
      </div>
    </AccordionPrimitive.Trigger>
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
    className={cn(
      "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className
    )}
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
