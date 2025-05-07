import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Тип для пользователя
interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  lastAccess: string | null;
  isActive: boolean;
  isSmmAdmin: boolean;
}

// Тип для ответа API
interface ApiResponse {
  success: boolean;
  data: {
    total: number;
    active: number;
    users: User[];
  };
  error?: string;
}

export default function UsersPage() {
  const { toast } = useToast();
  const { token, isAdmin } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  // Проверка прав администратора при монтировании компонента
  useEffect(() => {
    setIsMounted(true);

    if (!isAdmin) {
      toast({
        title: 'Доступ запрещен',
        description: 'У вас нет прав для просмотра этой страницы',
        variant: 'destructive',
      });
    }
  }, [isAdmin, toast]);

  // Запрос данных о пользователях
  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ['/api/users/active'],
    enabled: !!token && isAdmin && isMounted,
  });

  // Форматирование даты последнего доступа
  const formatLastAccess = (date: string | null): string => {
    if (!date) return 'Нет данных';
    
    try {
      return format(new Date(date), 'dd MMM yyyy, HH:mm', { locale: ru });
    } catch (e) {
      return 'Некорректная дата';
    }
  };

  // Если пользователь не админ, показываем сообщение о доступе
  if (!isAdmin && isMounted) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Управление пользователями</CardTitle>
            <CardDescription>
              Доступ к этой странице ограничен для администраторов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-6">
              <p className="text-center text-muted-foreground">
                У вас нет прав для просмотра информации о пользователях
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Управление пользователями</CardTitle>
          <CardDescription>
            Просмотр активных пользователей системы
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            // Скелетон загрузки
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            // Сообщение об ошибке
            <div className="flex items-center justify-center p-6">
              <p className="text-center text-destructive">
                Ошибка при загрузке данных о пользователях
              </p>
            </div>
          ) : data?.success ? (
            // Таблица с пользователями
            <>
              <div className="flex justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Всего пользователей: <span className="font-medium">{data.data.total}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Активных за 24 часа: <span className="font-medium">{data.data.active}</span>
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Последний доступ</TableHead>
                    <TableHead>Роль</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="success">Активен</Badge>
                        ) : (
                          <Badge variant="outline">Неактивен</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatLastAccess(user.lastAccess)}</TableCell>
                      <TableCell>
                        {user.isSmmAdmin ? (
                          <Badge variant="default">Администратор</Badge>
                        ) : (
                          <Badge variant="secondary">Пользователь</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            // Сообщение об отсутствии данных
            <div className="flex items-center justify-center p-6">
              <p className="text-center text-muted-foreground">
                Нет данных о пользователях
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}