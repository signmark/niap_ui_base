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

// Тип для активности пользователя
interface UserAction {
  description: string;
  timestamp: string;
  collection: string;
  action: string;
}

// Тип для последней активности пользователя
interface LastActivity {
  action: string;
  collection: string;
  timestamp: string;
}

// Тип для пользователя
interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  lastAccess: string | null;
  isActive: boolean;
  isSmmAdmin: boolean;
  activityCount: number;
  lastActivity: LastActivity | null;
  recentActions: UserAction[];
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
                    <TableHead>Последняя активность</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.users.map((user) => (
                    <TableRow key={user.id} className={user.isActive ? 'bg-green-50/20' : ''}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="success">Активен</Badge>
                        ) : (
                          <Badge variant="outline">Неактивен</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.lastActivity ? (
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {user.lastActivity.action === 'create' && 'Создал запись'}
                              {user.lastActivity.action === 'update' && 'Обновил запись'}
                              {user.lastActivity.action === 'delete' && 'Удалил запись'}
                              {user.lastActivity.action === 'login' && 'Вход в систему'}
                              {!['create', 'update', 'delete', 'login'].includes(user.lastActivity.action) && user.lastActivity.action}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user.lastActivity.collection && user.lastActivity.collection !== 'directus_users' ? 
                                `в разделе "${user.lastActivity.collection}"` : ''}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatLastAccess(user.lastActivity.timestamp)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm">Последний вход:</span>
                            <span className="block text-xs text-muted-foreground">
                              {formatLastAccess(user.lastAccess)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isSmmAdmin ? (
                          <Badge variant="default">Администратор</Badge>
                        ) : (
                          <Badge variant="secondary">Пользователь</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{user.activityCount || 0}</span> действий
                          {user.recentActions && user.recentActions.length > 0 && (
                            <div className="mt-1">
                              <details className="text-xs cursor-pointer">
                                <summary className="font-medium text-primary">Последние действия</summary>
                                <ul className="pl-2 mt-1 space-y-1">
                                  {user.recentActions.map((action, index) => (
                                    <li key={index} className="list-disc list-inside">
                                      <span>{action.description}</span>
                                      <span className="block text-xs text-muted-foreground ml-4">
                                        {formatLastAccess(action.timestamp)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            </div>
                          )}
                        </div>
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