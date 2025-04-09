import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function TelegramHtmlFormatter() {
  const [html, setHtml] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [chatId, setChatId] = useState<string>("");
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [formattedHtml, setFormattedHtml] = useState<string>("");
  const [sendResult, setSendResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("format");
  
  // Получаем доступ к toast
  const { toast } = useToast();

  const formatHtml = async () => {
    if (!html) {
      toast({
        title: "Ошибка",
        description: "Введите HTML-текст для форматирования",
        variant: "destructive",
      });
      return;
    }

    setIsFormatting(true);
    try {
      const response = await fetch("/api/telegram-html/format-html", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ html }),
      });

      const data = await response.json();
      if (data.success) {
        setFormattedHtml(data.formattedHtml);
        toast({
          title: "Готово!",
          description: "HTML успешно отформатирован для Telegram",
        });
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось отформатировать HTML",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить запрос: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsFormatting(false);
    }
  };

  const sendHtml = async () => {
    if (!html) {
      toast({
        title: "Ошибка",
        description: "Введите HTML-текст для отправки",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setSendResult(null);
    try {
      const response = await fetch("/api/telegram-html/send-html", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          html,
          token: token || undefined,
          chatId: chatId || undefined
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSendResult(data);
        toast({
          title: "Отправлено!",
          description: `Сообщение отправлено с ID: ${data.messageId}`,
        });
      } else {
        toast({
          title: "Ошибка",
          description: data.error || "Не удалось отправить HTML в Telegram",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выполнить запрос: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Форматирование HTML для Telegram</h1>
      <p className="mb-8 text-lg">
        Этот инструмент позволяет проверить, как будет выглядеть HTML-форматирование в Telegram, и отправить тестовое сообщение.
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Исходный HTML</CardTitle>
            <CardDescription>
              Введите HTML-текст, который вы хотите отформатировать для Telegram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Введите HTML-код здесь..."
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="min-h-[300px] font-mono"
            />
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p><strong>Поддерживаемые теги:</strong> &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;s&gt;, &lt;a&gt;, &lt;code&gt;</p>
              <p><strong>Непосредственно неподдерживаемые теги:</strong> &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;div&gt; и другие</p>
            </div>
            <div className="w-full flex justify-between gap-2">
              <Button 
                onClick={() => setHtml("")}
                variant="outline"
              >
                Очистить
              </Button>
              <Button 
                onClick={() => setHtml("<b>Жирный текст</b> и <i>курсив</i> с <a href='https://t.me'>ссылкой</a>\n\n<b>Список:</b>\n• Пункт 1\n• Пункт 2\n• Пункт 3")}
                variant="outline"
              >
                Пример
              </Button>
            </div>
          </CardFooter>
        </Card>

        <div>
          <Tabs defaultValue="format" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="format">Форматирование</TabsTrigger>
              <TabsTrigger value="send">Отправка в Telegram</TabsTrigger>
            </TabsList>
            
            <TabsContent value="format">
              <Card>
                <CardHeader>
                  <CardTitle>Отформатированный HTML</CardTitle>
                  <CardDescription>
                    Предпросмотр HTML после обработки для Telegram
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formattedHtml}
                    readOnly
                    className="min-h-[300px] font-mono"
                    placeholder="Здесь появится отформатированный HTML..."
                  />
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={formatHtml}
                    disabled={isFormatting || !html}
                    className="w-full"
                  >
                    {isFormatting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Форматировать HTML
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="send">
              <Card>
                <CardHeader>
                  <CardTitle>Отправка в Telegram</CardTitle>
                  <CardDescription>
                    Отправить HTML-форматированное сообщение в Telegram
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="token" className="text-sm font-medium">
                      Токен бота (необязательно)
                    </label>
                    <Input
                      id="token"
                      placeholder="Оставьте пустым для использования токена из .env"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="chatId" className="text-sm font-medium">
                      ID чата (необязательно)
                    </label>
                    <Input
                      id="chatId"
                      placeholder="Оставьте пустым для использования ID из .env"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                    />
                  </div>
                  
                  {sendResult && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
                      <p className="font-medium text-green-800 dark:text-green-300">Сообщение отправлено!</p>
                      <p className="text-sm">ID сообщения: {sendResult.messageId}</p>
                      {sendResult.messageUrl && (
                        <p className="mt-2">
                          <a 
                            href={sendResult.messageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Посмотреть сообщение в Telegram
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={sendHtml}
                    disabled={isSending || !html}
                    className="w-full"
                  >
                    {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Отправить в Telegram
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">Примеры HTML-форматирования для Telegram</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Базовое форматирование</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                {`<b>Жирный текст</b>
<i>Курсив</i>
<u>Подчеркнутый</u>
<s>Зачеркнутый</s>
<code>Моноширинный шрифт</code>
<a href="https://telegram.org">Ссылка</a>`}
              </pre>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setHtml(`<b>Жирный текст</b>
<i>Курсив</i>
<u>Подчеркнутый</u>
<s>Зачеркнутый</s>
<code>Моноширинный шрифт</code>
<a href="https://telegram.org">Ссылка</a>`);
                  setActiveTab("format");
                }}
              >
                Использовать этот пример
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Списки</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                {`<b>Маркированный список:</b>
• Первый пункт
• Второй пункт
• Третий пункт с <i>курсивом</i>

<b>Нумерованный список:</b>
1. Первый пункт
2. Второй пункт
3. Третий пункт`}
              </pre>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setHtml(`<b>Маркированный список:</b>
• Первый пункт
• Второй пункт
• Третий пункт с <i>курсивом</i>

<b>Нумерованный список:</b>
1. Первый пункт
2. Второй пункт
3. Третий пункт`);
                  setActiveTab("format");
                }}
              >
                Использовать этот пример
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Комбинированное форматирование</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                {`<b><i>Жирный и курсивный текст</i></b>
<u><s>Подчеркнутый и зачеркнутый</s></u>
<b>Жирный <i>с курсивом в середине</i> и снова жирный</b>
<b>Важное замечание</b>: обычный текст.`}
              </pre>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setHtml(`<b><i>Жирный и курсивный текст</i></b>
<u><s>Подчеркнутый и зачеркнутый</s></u>
<b>Жирный <i>с курсивом в середине</i> и снова жирный</b>
<b>Важное замечание</b>: обычный текст.`);
                  setActiveTab("format");
                }}
              >
                Использовать этот пример
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Сложный пример</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
                {`<b>Важная информация:</b>

<i>Сегодня на рынках наблюдается рост в следующих секторах:</i>

• <b>Технологии</b>: +2.5%
• <b>Финансы</b>: +1.8%
• <b>Здравоохранение</b>: +0.9%

<a href="https://example.com/markets">Подробный анализ</a>

<code>const price = getMarketPrice('TECH');</code>`}
              </pre>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setHtml(`<b>Важная информация:</b>

<i>Сегодня на рынках наблюдается рост в следующих секторах:</i>

• <b>Технологии</b>: +2.5%
• <b>Финансы</b>: +1.8%
• <b>Здравоохранение</b>: +0.9%

<a href="https://example.com/markets">Подробный анализ</a>

<code>const price = getMarketPrice('TECH');</code>`);
                  setActiveTab("format");
                }}
              >
                Использовать этот пример
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}