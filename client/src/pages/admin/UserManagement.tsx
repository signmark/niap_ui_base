import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Calendar, Settings, AlertTriangle } from 'lucide-react';

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_smm_admin?: boolean;
  expire_date?: string;
  last_access?: string;
  status: string;
}

interface UserStats {
  total: number;
  active_today: number;
  active_week: number;
  active_month: number;
  admins: number;
  expired: number;
  suspended: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Загрузка списка пользователей
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки пользователей');
      }

      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список пользователей",
        variant: "destructive",
      });
    }
  };

  // Загрузка статистики
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/users/activity', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки статистики');
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить статистику пользователей",
        variant: "destructive",
      });
    }
  };

  // Обновление пользователя
  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Ошибка обновления пользователя');
      }

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Успех",
          description: "Пользователь успешно обновлен",
        });
        loadUsers();
        setIsEditDialogOpen(false);
      }
    } catch (error) {
      console.error('Ошибка обновления пользователя:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить пользователя",
        variant: "destructive",
      });
    }
  };

  // Форматирование даты
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // Проверка истечения подписки
  const isExpired = (expireDate?: string) => {
    if (!expireDate) return false;
    return new Date(expireDate) < new Date();
  };

  // Получение статуса пользователя
  const getUserStatus = (user: User) => {
    if (user.status === 'suspended') return { label: 'Заблокирован', variant: 'destructive' as const };
    if (isExpired(user.expire_date)) return { label: 'Истекла подписка', variant: 'secondary' as const };
    if (user.is_smm_admin) return { label: 'Администратор', variant: 'default' as const };
    return { label: 'Активен', variant: 'default' as const };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadUsers(), loadStats()]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Управление пользователями</h1>
        <Button onClick={() => { loadUsers(); loadStats(); }}>
          Обновить
        </Button>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Активны сегодня</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_today}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Администраторы</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.admins}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Требуют внимания</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.expired + stats.suspended}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Список пользователей */}
      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => {
              const status = getUserStatus(user);
              return (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.email}
                      </h3>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      Последняя активность: {formatDate(user.last_access)}
                      {user.expire_date && (
                        <span className="ml-4">
                          Подписка до: {formatDate(user.expire_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Dialog open={isEditDialogOpen && selectedUser?.id === user.id} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        Редактировать
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Редактирование пользователя</DialogTitle>
                      </DialogHeader>
                      <UserEditForm user={user} onUpdate={updateUser} />
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Форма редактирования пользователя
function UserEditForm({ user, onUpdate }: { user: User; onUpdate: (userId: string, updates: Partial<User>) => void }) {
  const [formData, setFormData] = useState({
    is_smm_admin: user.is_smm_admin || false,
    expire_date: user.expire_date ? user.expire_date.split('T')[0] : '',
    status: user.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<User> = {};
    
    if (formData.is_smm_admin !== user.is_smm_admin) {
      updates.is_smm_admin = formData.is_smm_admin;
    }
    
    if (formData.expire_date !== (user.expire_date?.split('T')[0] || '')) {
      updates.expire_date = formData.expire_date || null;
    }
    
    if (formData.status !== user.status) {
      updates.status = formData.status;
    }

    onUpdate(user.id, updates);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_smm_admin}
            onChange={(e) => setFormData({ ...formData, is_smm_admin: e.target.checked })}
          />
          <span>Права администратора SMM</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Дата окончания подписки
        </label>
        <Input
          type="date"
          value={formData.expire_date}
          onChange={(e) => setFormData({ ...formData, expire_date: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Статус
        </label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full p-2 border rounded"
        >
          <option value="active">Активен</option>
          <option value="suspended">Заблокирован</option>
        </select>
      </div>

      <Button type="submit" className="w-full">
        Сохранить изменения
      </Button>
    </form>
  );
}