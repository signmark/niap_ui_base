import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown, Maximize, Minimize2 } from "lucide-react"
import { useLocation } from "wouter"

import { cn } from "@/lib/utils"

// Состояние для отслеживания максимизированного аккордеона
const AccordionContext = React.createContext<{
  maximizedItem: string | null;
  setMaximizedItem: (value: string | null) => void;
}>({
  maximizedItem: null,
  setMaximizedItem: () => {}
})

// Хук для использования контекста
export const useAccordionContext = () => React.useContext(AccordionContext)

// Модифицированный Accordion с поддержкой максимизации
const Accordion = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ children, ...props }, ref) => {
  // Состояние для отслеживания максимизированного элемента
  const [maximizedItem, setMaximizedItem] = React.useState<string | null>(null);
  
  return (
    <AccordionContext.Provider value={{ maximizedItem, setMaximizedItem }}>
      <AccordionPrimitive.Root 
        ref={ref}
        {...props} 
        className={cn(
          props.className,
          maximizedItem ? "relative" : ""
        )}
      >
        {children}
      </AccordionPrimitive.Root>
    </AccordionContext.Provider>
  );
});

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
    value: string; // value должно быть обязательным для корректной работы
  }
>(({ className, campaignId, value, ...props }, ref) => {
  // Получаем доступ к контексту для отслеживания максимизированного элемента
  const { maximizedItem } = useAccordionContext();
  
  // Определяем, является ли этот элемент максимизированным
  const isMaximized = maximizedItem === value;
  
  // Создаем копию props для передачи радиксу
  const itemProps = { ...props };
  
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        "border-b", 
        isMaximized ? "fixed inset-0 z-50 bg-background shadow-lg overflow-auto p-4" : "",
        className
      )}
      data-campaign-id={campaignId}
      data-value={value}
      value={value}
      data-maximized={isMaximized ? "true" : "false"}
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
  // Используем wouter hook для навигации
  const [_, setLocation] = useLocation();
  
  // Используем контекст для управления максимизацией
  const { maximizedItem, setMaximizedItem } = useAccordionContext();
  
  // Получаем значение аккордеона и ID кампании из родительского элемента
  const getParentData = () => {
    if (typeof window === 'undefined') return { value: null, campaignId: null };
    
    // Находим ближайший родительский AccordionItem
    const parent = document.activeElement?.closest('[data-value]');
    if (!parent) return { value: null, campaignId: null };
    
    const value = parent.getAttribute('data-value');
    const campaignId = parent.getAttribute('data-campaign-id');
    
    return { value, campaignId };
  };
  
  // Обработчик клика по кнопке "Открыть в новой странице"
  const handleFullscreenPage = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем срабатывание триггера аккордеона
    const { value, campaignId } = getParentData();
    const url = getFullscreenUrl(value, campaignId);
    
    if (url) {
      // Используем wouter для навигации вместо window.location
      setLocation(url);
    }
  };
  
  // Обработчик клика по кнопке "Максимизировать"
  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем срабатывание триггера аккордеона
    const { value } = getParentData();
    
    if (value) {
      // Если элемент уже максимизирован, то уменьшаем
      if (maximizedItem === value) {
        setMaximizedItem(null);
      } else {
        // Иначе максимизируем
        setMaximizedItem(value);
      }
    }
  };
  
  // Проверяем, максимизирован ли текущий элемент
  const isCurrentlyMaximized = (): boolean => {
    const { value } = getParentData();
    return maximizedItem === value;
  };
  
  // Функция для проверки, имеет ли аккордеон соответствующую полноэкранную страницу
  const hasFullscreenPage = (): boolean => {
    const { value } = getParentData();
    return Boolean(value && expandablePages[value] !== undefined);
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
        {/* Кнопка максимизации баяна */}
        <div 
          className="flex items-center cursor-pointer text-muted-foreground hover:text-primary"
          onClick={handleMaximize}
          title={isCurrentlyMaximized() ? "Вернуть размер" : "Развернуть баян"}
          aria-label={isCurrentlyMaximized() ? "Вернуть размер" : "Развернуть баян"}
        >
          {isCurrentlyMaximized() ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </div>
        
        {/* Кнопка для перехода на полноэкранную страницу - показываем только если есть страница */}
        {hasFullscreenPage() && (
          <div 
            className="flex items-center cursor-pointer text-muted-foreground hover:text-primary"
            onClick={handleFullscreenPage}
            title="Открыть на новой странице"
            aria-label="Открыть на новой странице"
          >
            <Maximize className="h-4 w-4 rotate-45" />
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
>(({ className, children, ...props }, ref) => {
  // Получаем доступ к контексту для отслеживания максимизированного элемента
  const { maximizedItem } = useAccordionContext();
  
  // Получаем значение родительского элемента
  const getParentValue = () => {
    if (typeof window === 'undefined') return null;
    
    // Ищем ближайший родительский AccordionItem (через DOM)
    const parent = document.activeElement?.closest('[data-value]');
    if (!parent) return null;
    
    return parent.getAttribute('data-value');
  };
  
  // Определяем, является ли этот контент максимизированным
  const isMaximized = maximizedItem === getParentValue();
  
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
        isMaximized ? "p-4" : "",
        className
      )}
      {...props}
    >
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
})

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
