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

// Простой компонент для кнопки "Развернуть на полный экран"
const FullScreenButton = ({ 
  value, 
  campaignId 
}: { 
  value?: string; 
  campaignId?: string 
}) => {
  const [_, setLocation] = useLocation();
  
  // Проверяем, имеет ли аккордеон соответствующую полноэкранную страницу
  const hasFullscreenPage = value && expandablePages[value] !== undefined;
  
  if (!hasFullscreenPage) return null;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value || !campaignId || !expandablePages[value]) return;
    const url = `${expandablePages[value]}?campaignId=${campaignId}`;
    setLocation(url);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="p-2 flex items-center cursor-pointer text-muted-foreground hover:text-primary"
        onClick={handleClick}
        title="Открыть на полном экране"
        aria-label="Открыть на полном экране"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  );
};

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(({ className, children, value, campaignId, ...props }, ref) => {
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
          <FullScreenButton value={value} campaignId={campaignId} />
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
