import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown, Maximize } from "lucide-react"

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
  }
>(({ className, campaignId, ...props }, ref) => {
  // Создаем копию props для передачи радиксу
  const itemProps = { ...props };
  
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn("border-b", className)}
      data-campaign-id={campaignId}
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
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  // Получаем значение аккордеона и ID кампании из родительского элемента
  const getParentData = () => {
    if (typeof window === 'undefined') return { value: null, campaignId: null };
    
    // Находим ближайший родительский AccordionItem
    const parent = document.activeElement?.closest('[data-accordion-value]');
    if (!parent) return { value: null, campaignId: null };
    
    const value = parent.getAttribute('data-accordion-value');
    const campaignId = parent.getAttribute('data-campaign-id');
    
    return { value, campaignId };
  };
  
  // Обработчик клика по кнопке "Развернуть на весь экран"
  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем срабатывание триггера аккордеона
    const { value, campaignId } = getParentData();
    const url = getFullscreenUrl(value, campaignId);
    
    if (url) {
      window.location.href = url;
    }
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
        {/* Кнопка для разворачивания на весь экран */}
        {/* Используем div вместо Maximize из-за проблем с типами */}
        <div 
          className="flex items-center cursor-pointer text-muted-foreground hover:text-primary"
          onClick={handleFullscreen}
          title="Открыть на полном экране"
          aria-label="Открыть на полном экране"
        >
          <Maximize className="h-4 w-4" />
        </div>
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
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
