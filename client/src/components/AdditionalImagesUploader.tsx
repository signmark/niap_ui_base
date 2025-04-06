import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ImageUploader";

interface AdditionalImagesUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  label?: string;
}

export function AdditionalImagesUploader({ 
  images = [], 
  onChange, 
  label = "Дополнительные изображения" 
}: AdditionalImagesUploaderProps) {
  
  // Обработчик изменения URL изображения
  const handleImageChange = (index: number, url: string) => {
    const updatedImages = [...images];
    updatedImages[index] = url;
    onChange(updatedImages);
  };
  
  // Обработчик удаления изображения
  const handleRemoveImage = (index: number) => {
    const updatedImages = [...images];
    updatedImages.splice(index, 1);
    onChange(updatedImages);
  };
  
  // Обработчик добавления нового изображения
  const handleAddImage = () => {
    onChange([...images, ""]);
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={handleAddImage}
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить изображение
        </Button>
      </div>
      
      {images.length > 0 ? (
        <div className="space-y-3">
          {images.map((imageUrl, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <ImageUploader
                  id={`additional-image-${index}`}
                  value={imageUrl}
                  onChange={(url) => handleImageChange(index, url)}
                  placeholder="Введите URL дополнительного изображения"
                />
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                className="h-9 w-9 mt-1"
                onClick={() => handleRemoveImage(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Нет дополнительных изображений. Нажмите "Добавить изображение" для добавления.
        </p>
      )}
    </div>
  );
}