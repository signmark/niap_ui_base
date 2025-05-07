import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatDistance } from "date-fns";
import { ru } from "date-fns/locale";
import { User, BadgeCheck, Users, Clock, Ban, UserCheck, UserX, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { API_ROUTES } from "@/config/routes";

interface UserData {
  id: string;
  name: string;
  email: string;
  status: string;
  lastAccess: string | null;
  isActive: boolean;
}

interface UsersResponse {
  success: boolean;
  data: {
    total: number;
    active: number;
    users: UserData[];
  };
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("all");

  const { data: usersData, isLoading, error, refetch } = useQuery<UsersResponse>({
    queryKey: ["users", "active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/active");
      const data = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 минут
  });

  // Обработка ошибок
  useEffect(() => {
    if (error) {
      toast({
        title: "Ошибка загрузки данных",
        description: "Не удалось загрузить информацию о пользователях",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const getFilteredUsers = () => {
    if (!usersData?.data?.users) return [];

    if (activeTab === "active") {
      return usersData.data.users.filter(user => user.isActive);
    } else if (activeTab === "inactive") {
      return usersData.data.users.filter(user => !user.isActive && user.status === "active");
    } else {
      return usersData.data.users;
    }
  };

  const formatLastAccess = (lastAccess: string | null) => {
    if (!lastAccess) return "Никогда";
    
    try {
      const date = new Date(lastAccess);
      return formatDistance(date, new Date(), { addSuffix: true, locale: ru });
    } catch (e) {
      return "Некорректная дата";
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.trim() === "") return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const getUserStatusBadge = (user: UserData) => {
    if (user.status === "active") {
      return user.isActive ? (
        <Badge variant="success" className="flex items-center gap-1">
          <UserCheck size={12} />
          <span>Активен</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock size={12} />
          <span>Неактивен</span>
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <Ban size={12} />
          <span>Заблокирован</span>
        </Badge>
      );
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Пользователи системы</h1>
          <p className="text-muted-foreground">
            Управление пользователями и мониторинг активности
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          Обновить
        </Button>
      </div>

      <div className="grid gap-6 mb-8">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Users size={16} />
                <span>Все</span>
                {usersData?.data?.total && (
                  <Badge variant="secondary">{usersData.data.total}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="flex items-center gap-2">
                <UserCheck size={16} />
                <span>Активные</span>
                {usersData?.data?.active && (
                  <Badge variant="secondary">{usersData.data.active}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inactive" className="flex items-center gap-2">
                <UserX size={16} />
                <span>Неактивные</span>
                {usersData?.data?.total && usersData?.data?.active && (
                  <Badge variant="secondary">{usersData.data.total - usersData.data.active}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Все пользователи системы</CardTitle>
                <CardDescription>
                  Полный список пользователей платформы
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getFilteredUsers().map((user) => (
                      <div key={user.id} className="flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <Avatar className="h-12 w-12 mr-4">
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-primary truncate mr-2">
                              {user.name || "Без имени"}
                            </p>
                            {getUserStatusBadge(user)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <div className="flex items-center text-sm">
                            <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatLastAccess(user.lastAccess)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {getFilteredUsers().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        {activeTab === "active" ? (
                          <p>Нет активных пользователей за последние 24 часа</p>
                        ) : activeTab === "inactive" ? (
                          <p>Все пользователи активны</p>
                        ) : (
                          <p>Пользователи не найдены</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Активный пользователь - тот, кто был в системе за последние 24 часа
                </p>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="active" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Активные пользователи</CardTitle>
                <CardDescription>
                  Пользователи, активные за последние 24 часа
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Содержимое то же самое, что и для all */}
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getFilteredUsers().map((user) => (
                      <div key={user.id} className="flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <Avatar className="h-12 w-12 mr-4">
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-primary truncate mr-2">
                              {user.name || "Без имени"}
                            </p>
                            {getUserStatusBadge(user)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <div className="flex items-center text-sm">
                            <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatLastAccess(user.lastAccess)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {getFilteredUsers().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Нет активных пользователей за последние 24 часа</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inactive" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Неактивные пользователи</CardTitle>
                <CardDescription>
                  Пользователи, которые не заходили в систему более 24 часов
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Содержимое то же самое, что и для all */}
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getFilteredUsers().map((user) => (
                      <div key={user.id} className="flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <Avatar className="h-12 w-12 mr-4">
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-primary truncate mr-2">
                              {user.name || "Без имени"}
                            </p>
                            {getUserStatusBadge(user)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <div className="flex items-center text-sm">
                            <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatLastAccess(user.lastAccess)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {getFilteredUsers().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>Нет неактивных пользователей</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}