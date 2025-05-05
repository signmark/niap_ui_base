import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import axios from 'axios';
import { ApiServiceName } from '@/lib/api-service-types';

interface GlobalApiKey {
  id: string;
  service_name: string;
  api_key: string;
  priority?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function GlobalApiKeysPage() {
  const { token, isAdmin } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<GlobalApiKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Состояние для новых ключей
  const [newService, setNewService] = useState<string>('');
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [newPriority, setNewPriority] = useState<number>(0);
  const [isAddingKey, setIsAddingKey] = useState(false);

  // Загрузка списка глобальных ключей
  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/global-api-keys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setKeys(response.data.data || []);
      } else {
        setError(response.data.message || 'Ошибка при загрузке глобальных API ключей');
        toast({
          variant: 'destructive',
          title: 'Ошибка загрузки',
          description: response.data.message || 'Ошибка при загрузке глобальных API ключей'
        });
      }
    } catch (err: any) {
      console.error('Ошибка при загрузке глобальных API ключей:', err);
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке глобальных API ключей');
      toast({
        variant: 'destructive',
        title: 'Ошибка загрузки',
        description: err.response?.data?.message || err.message || 'Ошибка при загрузке глобальных API ключей'
      });
    } finally {
      setLoading(false);
    }
  };

  // Добавление нового глобального ключа
  const addKey = async () => {
    if (!newService || !newApiKey) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Необходимо указать сервис и API ключ'
      });
      return;
    }
    
    setIsAddingKey(true);
    
    try {
      const response = await axios.post('/api/global-api-keys', {
        service: newService,
        apiKey: newApiKey,
        priority: newPriority
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: `Глобальный API ключ для сервиса ${newService} добавлен`
        });
        
        // Сбрасываем форму
        setNewService('');
        setNewApiKey('');
        setNewPriority(0);
        
        // Перезагружаем список ключей
        loadKeys();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: response.data.message || 'Ошибка при добавлении API ключа'
        });
      }
    } catch (err: any) {
      console.error('Ошибка при добавлении API ключа:', err);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: err.response?.data?.message || err.message || 'Ошибка при добавлении API ключа'
      });
    } finally {
      setIsAddingKey(false);
    }
  };

  // Обновление статуса активности ключа
  const toggleKeyActive = async (key: GlobalApiKey) => {
    try {
      const response = await axios.put(`/api/global-api-keys/${key.id}`, {
        active: !key.is_active
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: `Статус ключа для ${key.service_name} изменен`
        });
        
        // Обновляем список ключей
        loadKeys();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: response.data.message || 'Ошибка при обновлении статуса ключа'
        });
      }
    } catch (err: any) {
      console.error('Ошибка при обновлении статуса ключа:', err);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: err.response?.data?.message || err.message || 'Ошибка при обновлении статуса ключа'
      });
    }
  };

  // Удаление глобального ключа (деактивация)
  const deleteKey = async (key: GlobalApiKey) => {
    if (!confirm(`Вы уверены, что хотите деактивировать глобальный API ключ для сервиса ${key.service_name}?`)) {
      return;
    }
    
    try {
      const response = await axios.put(`/api/global-api-keys/${key.id}`, {
        active: false
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast({
          title: 'Успешно',
          description: `Глобальный API ключ для сервиса ${key.service_name} деактивирован`
        });
        
        // Обновляем список ключей
        loadKeys();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: response.data.message || 'Ошибка при деактивации API ключа'
        });
      }
    } catch (err: any) {
      console.error('Ошибка при деактивации API ключа:', err);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: err.response?.data?.message || err.message || 'Ошибка при деактивации API ключа'
      });
    }
  };

  // Загружаем список ключей при монтировании компонента
  useEffect(() => {
    if (token) {
      loadKeys();
    }
  }, [token]);

  // Если пользователь не администратор, показываем сообщение об ошибке
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Доступ запрещен</CardTitle>
            <CardDescription>
              Для управления глобальными API ключами необходимы права администратора
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center p-4 bg-amber-50 text-amber-800 rounded-md">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>У вас нет доступа к этой странице. Пожалуйста, обратитесь к администратору системы.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Управление глобальными API ключами</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Добавить новый глобальный API ключ</CardTitle>
          <CardDescription>
            Глобальные API ключи используются всеми пользователями системы, у которых нет персональных ключей
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="service">Сервис</Label>
                <Select value={newService} onValueChange={setNewService}>
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Выберите сервис" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ApiServiceName).map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="apiKey">API Ключ</Label>
                <Input
                  id="apiKey"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Введите API ключ"
                />
              </div>
              
              <div>
                <Label htmlFor="priority">Приоритет</Label>
                <Input
                  id="priority"
                  type="number"
                  value={newPriority.toString()}
                  onChange={(e) => setNewPriority(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button onClick={addKey} disabled={isAddingKey || !newService || !newApiKey}>
                {isAddingKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Добавление...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить ключ
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Список глобальных API ключей</CardTitle>
          <CardDescription>
            Управление существующими глобальными API ключами
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Загрузка ключей...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-md">
              <p className="font-medium">Ошибка загрузки ключей</p>
              <p>{error}</p>
            </div>
          ) : keys.length === 0 ? (
            <div className="bg-gray-50 p-4 rounded-md text-center">
              <p>Глобальные API ключи не найдены</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left border">Сервис</th>
                    <th className="p-2 text-left border">API Ключ</th>
                    <th className="p-2 text-center border">Приоритет</th>
                    <th className="p-2 text-center border">Активен</th>
                    <th className="p-2 text-center border">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className={key.is_active ? '' : 'text-gray-400'}>
                      <td className="p-2 border">{key.service_name}</td>
                      <td className="p-2 border">
                        <span className="font-mono">
                          {key.api_key.length > 20
                            ? `${key.api_key.slice(0, 10)}...${key.api_key.slice(-10)}`
                            : key.api_key}
                        </span>
                        <span className="ml-2 text-gray-400 text-xs">
                          ({key.api_key.length} символов)
                        </span>
                      </td>
                      <td className="p-2 border text-center">{key.priority || 0}</td>
                      <td className="p-2 border text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={key.is_active}
                            onCheckedChange={() => toggleKeyActive(key)}
                          />
                        </div>
                      </td>
                      <td className="p-2 border text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKey(key)}
                          disabled={!key.is_active}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
