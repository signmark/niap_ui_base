import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';

export default function TestImgur() {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [contentId, setContentId] = useState('');
  const [platform, setPlatform] = useState('telegram');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Функция для загрузки списка изображений
  const fetchUploadedImages = async () => {
    try {
      const response = await axios.get('/api/imgur/images');
      if (response.data.success) {
        setUploadedImages(response.data.data.images);
      }
    } catch (error) {
      console.error('Ошибка при загрузке списка изображений:', error);
    }
  };

  // Загрузка списка изображений при монтировании компонента
  useEffect(() => {
    fetchUploadedImages();
  }, []);

  const uploadSingleImage = async () => {
    if (!imageUrl) {
      toast({
        title: 'Ошибка',
        description: 'Введите URL изображения',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/imgur/upload-from-url', {
        imageUrl
      });
      
      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: 'Изображение загружено на Imgur',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: response.data.error || 'Неизвестная ошибка',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setResult(error.response?.data || error.message);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadMultipleImages = async () => {
    if (!imageUrls) {
      toast({
        title: 'Ошибка',
        description: 'Введите URL изображений (по одному на строку)',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const urls = imageUrls.split('\n').filter(url => url.trim() !== '');
      
      if (urls.length === 0) {
        throw new Error('Нет корректных URL для загрузки');
      }
      
      const response = await axios.post('/api/imgur/upload-multiple', {
        imageUrls: urls
      });
      
      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: `Загружено ${response.data.data.totalUploaded} из ${response.data.data.totalRequested} изображений`,
        });
      } else {
        toast({
          title: 'Ошибка',
          description: response.data.error || 'Неизвестная ошибка',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setResult(error.response?.data || error.message);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testTelegramPublication = async () => {
    if (!contentId) {
      toast({
        title: 'Ошибка',
        description: 'Введите ID контента',
        variant: 'destructive'
      });
      return;
    }

    if (!telegramToken || !telegramChatId) {
      toast({
        title: 'Ошибка',
        description: 'Введите токен и ID чата Telegram',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/imgur/test-telegram-publication', {
        contentId,
        telegramToken,
        telegramChatId
      });
      
      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: 'Контент опубликован в Telegram',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: response.data.error || 'Неизвестная ошибка',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setResult(error.response?.data || error.message);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const publishContent = async () => {
    if (!contentId) {
      toast({
        title: 'Ошибка',
        description: 'Введите ID контента',
        variant: 'destructive'
      });
      return;
    }

    if (platform === 'telegram' && (!telegramToken || !telegramChatId)) {
      toast({
        title: 'Ошибка',
        description: 'Введите токен и ID чата Telegram',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const settings = {
        telegram: {
          token: telegramToken,
          chatId: telegramChatId
        }
      };
      
      const response = await axios.post('/api/imgur/publish-content', {
        contentId,
        platform,
        settings,
        userId: '53921f16-f51d-4591-80b9-8caa4fde4d13' // ID тестового пользователя, в реальном приложении должен быть динамическим
      });
      
      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: `Контент опубликован в ${platform}`,
        });
      } else {
        toast({
          title: 'Ошибка',
          description: response.data.error || 'Неизвестная ошибка',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setResult(error.response?.data || error.message);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Функция для загрузки файла на сервер
  const uploadFile = async () => {
    if (!fileInputRef.current?.files?.length) {
      toast({
        title: 'Ошибка',
        description: 'Выберите файл для загрузки',
        variant: 'destructive'
      });
      return;
    }
    
    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append('image', file);
    
    setLoading(true);
    try {
      const response = await axios.post('/api/imgur/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setResult(response.data);
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: 'Файл загружен и опубликован на Imgur',
        });
        // Обновляем список файлов
        fetchUploadedImages();
        // Очищаем поле выбора файла
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        toast({
          title: 'Ошибка',
          description: response.data.error || 'Неизвестная ошибка',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setResult(error.response?.data || error.message);
      toast({
        title: 'Ошибка',
        description: error.response?.data?.error || error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Функция для получения проксированного URL изображения
  const getProxiedImageUrl = (imageUrl: string) => {
    if (!imageUrl) return '';
    // Проверяем, является ли URL локальным (не требует прокси)
    if (imageUrl.startsWith('/uploads/')) {
      return imageUrl;
    }
    // Иначе проксируем изображение через наш API
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Тестирование Imgur интеграции</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Загрузка одиночного изображения</CardTitle>
            <CardDescription>Загрузка изображения на Imgur по URL</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="imageUrl">URL изображения</Label>
                <Input
                  id="imageUrl"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
              
              {imageUrl && (
                <div className="mt-4">
                  <Label>Предпросмотр URL:</Label>
                  <div className="mt-2 p-2 border rounded-md">
                    <img 
                      src={getProxiedImageUrl(imageUrl)} 
                      alt="Предпросмотр" 
                      className="max-w-full max-h-[200px] mx-auto"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMiAyMkM2LjQ3NyAyMiAyIDE3LjUyMyAyIDEyUzYuNDc3IDIgMTIgMnMxMCA0LjQ3NyAxMCAxMC00LjQ3NyAxMC0xMCAxMHptMC0xMWExIDEgMCAxMDAgMiAxIDEgMCAwMDAtMnptMC0uNzVjLjY5IDAgMS4yNS0uNTYgMS4yNS0xLjI1di0xYzAtLjY5LS41Ni0xLjI1LTEuMjUtMS4yNVMxMC43NSA3LjMxIDEwLjc1IDh2MWMwIC42OS41NiAxLjI1IDEuMjUgMS4yNXoiIGZpbGw9IiNjNWM1YzUiLz48L3N2Zz4=';
                        e.currentTarget.alt = 'Ошибка загрузки изображения';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={uploadSingleImage} disabled={loading}>
              {loading ? 'Загрузка...' : 'Загрузить изображение'}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Загрузка локального файла</CardTitle>
            <CardDescription>Загрузка изображения с локального компьютера на Imgur</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fileInput">Выберите файл</Label>
                <Input
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => {
                    // Просто для визуального эффекта, если нужно будет добавить превью загружаемого файла
                    if (e.target.files && e.target.files.length > 0) {
                      const file = e.target.files[0];
                      if (file.type.startsWith('image/')) {
                        // Для отображения превью можно использовать URL.createObjectURL
                        const previewUrl = URL.createObjectURL(file);
                        setSelectedImage(previewUrl);
                      }
                    } else {
                      setSelectedImage(null);
                    }
                  }}
                />
              </div>
              
              {selectedImage && (
                <div className="mt-4">
                  <Label>Предпросмотр выбранного файла:</Label>
                  <div className="mt-2 p-2 border rounded-md">
                    <img 
                      src={selectedImage} 
                      alt="Предпросмотр" 
                      className="max-w-full max-h-[200px] mx-auto"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMiAyMkM2LjQ3NyAyMiAyIDE3LjUyMyAyIDEyUzYuNDc3IDIgMTIgMnMxMCA0LjQ3NyAxMCAxMC00LjQ3NyAxMC0xMCAxMHptMC0xMWExIDEgMCAxMDAgMiAxIDEgMCAwMDAtMnptMC0uNzVjLjY5IDAgMS4yNS0uNTYgMS4yNS0xLjI1di0xYzAtLjY5LS41Ni0xLjI1LTEuMjUtMS4yNVMxMC43NSA3LjMxIDEwLjc1IDh2MWMwIC42OS41NiAxLjI1IDEuMjUgMS4yNXoiIGZpbGw9IiNjNWM1YzUiLz48L3N2Zz4=';
                        e.currentTarget.alt = 'Ошибка загрузки изображения';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={uploadFile} disabled={loading}>
              {loading ? 'Загрузка...' : 'Загрузить файл'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Секция с загруженными изображениями */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Загруженные изображения</CardTitle>
            <CardDescription>Список всех загруженных изображений</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {uploadedImages.length > 0 ? (
                uploadedImages.map((image, index) => (
                  <div key={index} className="border rounded-md overflow-hidden flex flex-col">
                    <div className="h-32 bg-gray-100 flex items-center justify-center">
                      <img 
                        src={image.path} 
                        alt={image.name}
                        className="max-w-full max-h-32 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0xMiAyMkM2LjQ3NyAyMiAyIDE3LjUyMyAyIDEyUzYuNDc3IDIgMTIgMnMxMCA0LjQ3NyAxMCAxMC00LjQ3NyAxMC0xMCAxMHptMC0xMWExIDEgMCAxMDAgMiAxIDEgMCAwMDAtMnptMC0uNzVjLjY5IDAgMS4yNS0uNTYgMS4yNS0xLjI1di0xYzAtLjY5LS41Ni0xLjI1LTEuMjUtMS4yNVMxMC43NSA3LjMxIDEwLjc1IDh2MWMwIC42OS41NiAxLjI1IDEuMjUgMS4yNXoiIGZpbGw9IiNjNWM1YzUiLz48L3N2Zz4=';
                          e.currentTarget.alt = 'Ошибка загрузки изображения';
                        }}
                      />
                    </div>
                    <div className="p-2 text-xs truncate" title={image.name}>
                      {image.name}
                    </div>
                    <div className="p-2 pt-0 text-xs text-gray-500">
                      {Math.round(image.size / 1024)} KB
                    </div>
                    <div className="mt-auto p-2 pt-0">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + image.path);
                          toast({
                            title: 'Скопировано',
                            description: 'Путь к изображению скопирован в буфер обмена',
                          });
                        }}
                      >
                        Копировать URL
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-gray-500">
                  Нет загруженных изображений
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={fetchUploadedImages} 
              variant="outline"
            >
              Обновить список
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Публикация контента с Imgur</CardTitle>
            <CardDescription>Тестирование публикации в социальные сети с загрузкой изображений на Imgur</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contentId">ID контента</Label>
                <Input
                  id="contentId"
                  placeholder="uuid контента в Directus"
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="platform">Платформа</Label>
                <select
                  id="platform"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              
              {platform === 'telegram' && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="telegramToken">Telegram API токен</Label>
                    <Input
                      id="telegramToken"
                      placeholder="1234567890:AAFfRTa-4XYZabc-YourToken"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="telegramChatId">Telegram Chat ID</Label>
                    <Input
                      id="telegramChatId"
                      placeholder="-1001234567890"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button onClick={testTelegramPublication} disabled={loading} variant="outline">
              {loading ? 'Публикация...' : 'Тест публикации в Telegram'}
            </Button>
            
            <Button onClick={publishContent} disabled={loading}>
              {loading ? 'Публикация...' : 'Опубликовать через универсальный API'}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Результат</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">
              {result ? JSON.stringify(result, null, 2) : 'Нет данных'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}