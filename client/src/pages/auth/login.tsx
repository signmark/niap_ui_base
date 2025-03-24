import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { directusApi } from "@/lib/directus";
import { setupTokenRefresh } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Неверный формат email"),
  password: z.string().min(1, "Пароль обязателен"),
});

export default function Login() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      console.log('Attempting login with:', values.email);

      // Прямой запрос к Directus API вместо использования клиента
      const response = await fetch('https://directus.nplanner.ru/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          mode: 'json'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Login response error:', errorText);
        throw new Error("Ошибка при входе: " + response.statusText);
      }

      const authData = await response.json();
      
      if (!authData?.data?.access_token) {
        throw new Error("Неверный формат ответа от сервера");
      }

      const { access_token, refresh_token, expires } = authData.data;
      console.log('Received auth tokens, access token length:', access_token.length);

      // Получаем информацию о пользователе
      const userResponse = await fetch('https://directus.nplanner.ru/users/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('User data fetch error:', errorText);
        throw new Error("Не удалось получить информацию о пользователе");
      }

      const userData = await userResponse.json();

      if (!userData?.data?.id) {
        throw new Error("Не удалось получить ID пользователя");
      }

      const userId = userData.data.id;
      console.log('Login successful, user ID:', userId);
      
      // Сохраняем в localStorage и в state
      localStorage.setItem('auth_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user_id', userId);
      
      // Также обновляем состояние авторизации
      setAuth(access_token, userId);

      // Устанавливаем автоматическое обновление токена
      setupTokenRefresh(expires);
      
      // Добавляем задержку в 100мс, чтобы дать другим компонентам времени обновиться
      await new Promise(resolve => setTimeout(resolve, 100));

      // Редирект на главную
      navigate("/campaigns");

      toast({
        title: "Успешный вход",
        description: "Добро пожаловать в SMM Manager",
      });

    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Ошибка входа",
        description: error instanceof Error ? error.message : "Проверьте email и пароль",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Вход в SMM Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Введите email" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Введите пароль" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Вход...
                  </>
                ) : (
                  "Войти"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}