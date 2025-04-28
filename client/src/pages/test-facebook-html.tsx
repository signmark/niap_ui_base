import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export default function TestFacebookHTMLPage() {
  const [htmlText, setHtmlText] = useState(`
<div>
  <h2>Заголовок поста</h2>
  <p>Это <strong>жирный текст</strong> и <em>курсив</em>.</p>
  <p>Абзац с <a href="https://example.com">ссылкой</a> внутри.</p>
  <ul>
    <li>Пункт списка 1</li>
    <li>Пункт списка 2</li>
  </ul>
  <div>Вложенный <span style="color: red;">текст</span> с стилями</div>
  <p>Текст с символами &amp; и &quot;кавычками&quot; и&nbsp;неразрывными&nbsp;пробелами</p>
</div>
  `);
  
  const [cleanedHtml, setCleanedHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/test/facebook-cleaning', {
        html: htmlText
      });
      
      setCleanedHtml(response.data.cleaned);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при обработке HTML');
      console.error('Error testing Facebook HTML cleaning:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Тестирование очистки HTML для Facebook</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">HTML для очистки:</h2>
        <Textarea
          value={htmlText}
          onChange={(e) => setHtmlText(e.target.value)}
          rows={10}
          className="w-full font-mono text-sm"
        />
      </div>
      
      <Button 
        onClick={handleTest}
        disabled={loading}
        className="mb-6"
      >
        {loading ? 'Обработка...' : 'Проверить очистку HTML'}
      </Button>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {cleanedHtml && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="p-4">
              <h3 className="text-md font-semibold mb-2">Исходный HTML:</h3>
              <div className="border p-4 rounded bg-gray-50 whitespace-pre-wrap font-mono text-xs">
                {htmlText}
              </div>
            </Card>
            
            <Card className="p-4">
              <h3 className="text-md font-semibold mb-2">Очищенный текст для Facebook:</h3>
              <div className="border p-4 rounded bg-gray-50 whitespace-pre-wrap font-mono text-xs">
                {cleanedHtml}
              </div>
            </Card>
          </div>
          
          <Card className="p-4">
            <h3 className="text-md font-semibold mb-2">Предпросмотр в Facebook (как будет выглядеть):</h3>
            <div className="border p-4 rounded bg-white text-sm">
              {cleanedHtml.split('\n\n').map((paragraph, index) => (
                <p key={index} className="mb-2">{paragraph}</p>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}