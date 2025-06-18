import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Vote, Brain, Sliders, Heart, Star } from 'lucide-react';

interface PollElementProps {
  pollData?: {
    question: string;
    options: string[];
  };
  onChange: (pollData: any) => void;
}

export const PollElement: React.FC<PollElementProps> = ({ pollData, onChange }) => {
  const [question, setQuestion] = useState(pollData?.question || 'Ваш вопрос?');
  const [options, setOptions] = useState(pollData?.options || ['Вариант 1', 'Вариант 2']);

  const updatePoll = () => {
    onChange({ question, options });
  };

  const addOption = () => {
    const newOptions = [...options, `Вариант ${options.length + 1}`];
    setOptions(newOptions);
    onChange({ question, options: newOptions });
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      onChange({ question, options: newOptions });
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    onChange({ question, options: newOptions });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <Vote className="w-4 h-4 mr-2" />
        <CardTitle className="text-sm">Голосование</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="poll-question" className="text-xs">Вопрос</Label>
          <Input
            id="poll-question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              updatePoll();
            }}
            className="text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">Варианты ответов</Label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                className="text-sm"
              />
              {options.length > 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeOption(index)}
                  className="p-1 h-8 w-8"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          
          {options.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addOption}
              className="w-full text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Добавить вариант
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface QuizElementProps {
  quizData?: {
    question: string;
    options: string[];
    correctAnswer: number;
  };
  onChange: (quizData: any) => void;
}

export const QuizElement: React.FC<QuizElementProps> = ({ quizData, onChange }) => {
  const [question, setQuestion] = useState(quizData?.question || 'Вопрос викторины?');
  const [options, setOptions] = useState(quizData?.options || ['Вариант A', 'Вариант B']);
  const [correctAnswer, setCorrectAnswer] = useState(quizData?.correctAnswer || 0);

  const updateQuiz = () => {
    onChange({ question, options, correctAnswer });
  };

  const addOption = () => {
    const newOptions = [...options, `Вариант ${String.fromCharCode(65 + options.length)}`];
    setOptions(newOptions);
    onChange({ question, options: newOptions, correctAnswer });
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      const newCorrectAnswer = correctAnswer >= index ? Math.max(0, correctAnswer - 1) : correctAnswer;
      setOptions(newOptions);
      setCorrectAnswer(newCorrectAnswer);
      onChange({ question, options: newOptions, correctAnswer: newCorrectAnswer });
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    onChange({ question, options: newOptions, correctAnswer });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <Brain className="w-4 h-4 mr-2" />
        <CardTitle className="text-sm">Викторина</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="quiz-question" className="text-xs">Вопрос</Label>
          <Input
            id="quiz-question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              updateQuiz();
            }}
            className="text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label className="text-xs">Варианты ответов</Label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="radio"
                name="correct-answer"
                checked={correctAnswer === index}
                onChange={() => {
                  setCorrectAnswer(index);
                  updateQuiz();
                }}
                className="w-4 h-4"
              />
              <Input
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                className="text-sm"
              />
              {options.length > 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeOption(index)}
                  className="p-1 h-8 w-8"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          
          {options.length < 4 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addOption}
              className="w-full text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Добавить вариант
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface SliderElementProps {
  sliderData?: {
    question: string;
    minLabel: string;
    maxLabel: string;
  };
  onChange: (sliderData: any) => void;
}

export const SliderElement: React.FC<SliderElementProps> = ({ sliderData, onChange }) => {
  const [question, setQuestion] = useState(sliderData?.question || 'Оцените от 1 до 10');
  const [minLabel, setMinLabel] = useState(sliderData?.minLabel || '1');
  const [maxLabel, setMaxLabel] = useState(sliderData?.maxLabel || '10');

  const updateSlider = () => {
    onChange({ question, minLabel, maxLabel });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <Sliders className="w-4 h-4 mr-2" />
        <CardTitle className="text-sm">Слайдер оценки</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="slider-question" className="text-xs">Вопрос</Label>
          <Input
            id="slider-question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              updateSlider();
            }}
            className="text-sm"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="min-label" className="text-xs">Мин. значение</Label>
            <Input
              id="min-label"
              value={minLabel}
              onChange={(e) => {
                setMinLabel(e.target.value);
                updateSlider();
              }}
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="max-label" className="text-xs">Макс. значение</Label>
            <Input
              id="max-label"
              value={maxLabel}
              onChange={(e) => {
                setMaxLabel(e.target.value);
                updateSlider();
              }}
              className="text-sm"
            />
          </div>
        </div>
        
        {/* Предварительный просмотр слайдера */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{minLabel}</span>
            <span>{maxLabel}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full relative">
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface StickerElementProps {
  stickerData?: {
    type: string;
    size: number;
  };
  onChange: (stickerData: any) => void;
}

export const StickerElement: React.FC<StickerElementProps> = ({ stickerData, onChange }) => {
  const [stickerType, setStickerType] = useState(stickerData?.type || 'heart');
  const [size, setSize] = useState(stickerData?.size || 50);

  const stickers = [
    { type: 'heart', emoji: '❤️', label: 'Сердце' },
    { type: 'fire', emoji: '🔥', label: 'Огонь' },
    { type: 'star', emoji: '⭐', label: 'Звезда' },
    { type: 'thumbs_up', emoji: '👍', label: 'Лайк' },
    { type: 'clap', emoji: '👏', label: 'Аплодисменты' }
  ];

  const updateSticker = (newType: string, newSize: number) => {
    setStickerType(newType);
    setSize(newSize);
    onChange({ type: newType, size: newSize });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <Star className="w-4 h-4 mr-2" />
        <CardTitle className="text-sm">Стикер</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Выберите стикер</Label>
          <div className="grid grid-cols-5 gap-1 mt-1">
            {stickers.map((sticker) => (
              <Button
                key={sticker.type}
                variant={stickerType === sticker.type ? "default" : "outline"}
                size="sm"
                onClick={() => updateSticker(sticker.type, size)}
                className="h-10 p-1"
                title={sticker.label}
              >
                <span style={{ fontSize: '20px' }}>{sticker.emoji}</span>
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <Label htmlFor="sticker-size" className="text-xs">Размер: {size}px</Label>
          <input
            id="sticker-size"
            type="range"
            min="30"
            max="100"
            value={size}
            onChange={(e) => updateSticker(stickerType, parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1"
          />
        </div>
        
        {/* Предварительный просмотр */}
        <div className="flex justify-center pt-2">
          <span style={{ fontSize: `${size}px` }}>
            {stickers.find(s => s.type === stickerType)?.emoji}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};