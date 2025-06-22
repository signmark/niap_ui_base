import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Plus, 
  Type, 
  Image, 
  Video, 
  BarChart3, 
  Sparkles,
  ArrowLeft,
  Save,
  Play,
  Trash2,
  Move
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StoryEditor } from "@/components/stories/StoryEditor";

interface StorySlide {
  id: string;
  order: number;
  duration: number;
  background: {
    type: 'color' | 'image' | 'video';
    value: string;
  };
  elements: StoryElement[];
}

interface StoryElement {
  id: string;
  type: 'text' | 'image' | 'video' | 'poll' | 'quiz';
  position: { x: number; y: number };
  rotation: number;
  zIndex: number;
  content: any;
  style?: any;
}

interface Story {
  id?: string;
  title: string;
  campaignId: string;
  slides: StorySlide[];
  status: 'draft' | 'scheduled' | 'published';
}

export default function StoriesPage() {
  const { campaignId } = useParams();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  const [story, setStory] = useState<Story>({
    title: "",
    campaignId: campaignId || "",
    slides: [],
    status: 'draft'
  });
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const addSlide = () => {
    const newSlide: StorySlide = {
      id: `slide-${Date.now()}`,
      order: story.slides.length,
      duration: 5,
      background: { type: 'color', value: '#000000' },
      elements: []
    };
    
    setStory(prev => ({
      ...prev,
      slides: [...prev.slides, newSlide]
    }));
    
    setCurrentSlideIndex(story.slides.length);
  };

  const updateSlide = (slideIndex: number, updates: Partial<StorySlide>) => {
    setStory(prev => ({
      ...prev,
      slides: prev.slides.map((slide, index) => 
        index === slideIndex ? { ...slide, ...updates } : slide
      )
    }));
  };

  const addElement = (type: StoryElement['type']) => {
    if (story.slides.length === 0) {
      toast({
        title: "Добавьте слайд",
        description: "Сначала создайте слайд для добавления элементов",
        variant: "destructive"
      });
      return;
    }

    const newElement: StoryElement = {
      id: `element-${Date.now()}`,
      type,
      position: { x: 50, y: 50 },
      rotation: 0,
      zIndex: story.slides[currentSlideIndex]?.elements.length || 0,
      content: getDefaultContent(type)
    };

    const updatedSlide = {
      ...story.slides[currentSlideIndex],
      elements: [...(story.slides[currentSlideIndex]?.elements || []), newElement]
    };

    updateSlide(currentSlideIndex, updatedSlide);
  };

  const getDefaultContent = (type: StoryElement['type']) => {
    switch (type) {
      case 'text':
        return { text: 'Введите текст', fontSize: 24, color: '#ffffff' };
      case 'image':
        return { url: '', alt: '' };
      case 'video':
        return { url: '' };
      case 'poll':
        return { question: 'Ваш вопрос?', options: ['Вариант 1', 'Вариант 2'] };
      case 'quiz':
        return { question: 'Вопрос викторины?', options: ['Вариант 1', 'Вариант 2'], correctAnswer: 0 };
      default:
        return {};
    }
  };

  const saveStory = async () => {
    try {
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: story.title,
          campaignId: story.campaignId,
          metadata: {
            slides: story.slides,
            interactiveElements: story.slides.flatMap(slide => 
              slide.elements.filter(el => ['poll', 'quiz'].includes(el.type))
            )
          }
        })
      });

      if (response.ok) {
        toast({
          title: "Stories сохранены",
          description: "Ваши Stories успешно сохранены"
        });
      } else {
        throw new Error('Ошибка сохранения');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить Stories",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate(`/campaigns/${campaignId}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к кампании
            </Button>
            <h1 className="text-2xl font-bold">Редактор Stories</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Play className="w-4 h-4 mr-2" />
              Предпросмотр
            </Button>
            <Button onClick={saveStory}>
              <Save className="w-4 h-4 mr-2" />
              Сохранить
            </Button>
          </div>
        </div>

        {/* Story Title */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Название Stories</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={story.title}
              onChange={(e) => setStory(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Введите название Stories"
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Slides Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Слайды ({story.slides.length})</CardTitle>
                <Button size="sm" onClick={addSlide}>
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {story.slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      index === currentSlideIndex ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setCurrentSlideIndex(index)}
                  >
                    <div className="text-sm font-medium">Слайд {index + 1}</div>
                    <div className="text-xs text-gray-500">{slide.duration}с</div>
                    <div className="text-xs text-gray-500">{slide.elements.length} элементов</div>
                  </div>
                ))}
                
                {story.slides.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-sm">Нет слайдов</div>
                    <Button size="sm" variant="outline" className="mt-2" onClick={addSlide}>
                      Создать первый слайд
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Editor Panel */}
          <div className="lg:col-span-2">
            <Card className="h-96">
              <CardHeader>
                <CardTitle>
                  {story.slides[currentSlideIndex] ? `Слайд ${currentSlideIndex + 1}` : 'Редактор'}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full">
                {story.slides[currentSlideIndex] ? (
                  <StoryEditor
                    slide={story.slides[currentSlideIndex]}
                    onUpdateSlide={(updates) => updateSlide(currentSlideIndex, updates)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Выберите слайд для редактирования
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tools Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Инструменты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Elements */}
                <div>
                  <Label className="text-sm font-medium">Добавить элементы</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={() => addElement('text')}>
                      <Type className="w-4 h-4 mr-1" />
                      Текст
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('image')}>
                      <Image className="w-4 h-4 mr-1" />
                      Фото
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('video')}>
                      <Video className="w-4 h-4 mr-1" />
                      Видео
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addElement('poll')}>
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Опрос
                    </Button>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => addElement('quiz')}
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Викторина
                  </Button>
                </div>

                {/* Slide Duration */}
                {story.slides[currentSlideIndex] && (
                  <div>
                    <Label className="text-sm font-medium">
                      Продолжительность: {story.slides[currentSlideIndex].duration}с
                    </Label>
                    <Slider
                      value={[story.slides[currentSlideIndex].duration]}
                      onValueChange={(value) => updateSlide(currentSlideIndex, { duration: value[0] })}
                      min={1}
                      max={15}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}