import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

interface SubscriptionStatus {
  isExpired: boolean;
  daysLeft: number;
  expireDate?: string;
}

export function SubscriptionExpiredBanner() {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);

  console.log('SubscriptionExpiredBanner: компонент загружен', { token: !!token, userId });

  useEffect(() => {
    const checkSubscription = async () => {
      if (!token || !userId) return;

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const user = data.user;

        if (!user?.expire_date) {
          // Нет даты окончания = безлимитная подписка
          setSubscriptionStatus(null);
          return;
        }

        const now = new Date();
        const expireDate = new Date(user.expire_date);
        const timeDiff = expireDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

        setSubscriptionStatus({
          isExpired: daysLeft <= 0,
          daysLeft: Math.max(0, daysLeft),
          expireDate: expireDate.toLocaleDateString('ru-RU')
        });
      } catch (error) {
        console.error('Ошибка при проверке статуса подписки:', error);
      }
    };

    checkSubscription();
  }, [token, userId]);

  if (!subscriptionStatus || !isVisible) {
    return null;
  }

  const { isExpired, daysLeft, expireDate } = subscriptionStatus;

  // Показываем предупреждение если подписка истекла или истечет в течение 7 дней
  if (!isExpired && daysLeft > 7) {
    return null;
  }

  const bannerType = isExpired ? 'expired' : 'warning';
  const bgColor = isExpired ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
  const textColor = isExpired ? 'text-red-800' : 'text-yellow-800';
  const iconColor = isExpired ? 'text-red-600' : 'text-yellow-600';

  return (
    <div className={`${bgColor} border-l-4 p-4 mb-4 ${textColor}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {isExpired ? 'Подписка истекла' : 'Подписка истекает'}
          </h3>
          <div className="mt-1 text-sm">
            {isExpired ? (
              <p>
                Ваша подписка истекла {expireDate}. Для продолжения работы с системой обратитесь к администратору.
              </p>
            ) : (
              <p>
                Ваша подписка истечет через {daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'} ({expireDate}). 
                Обратитесь к администратору для продления.
              </p>
            )}
          </div>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={() => setIsVisible(false)}
            className={`inline-flex rounded-md p-1.5 ${textColor} hover:bg-red-100 focus:outline-none`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}