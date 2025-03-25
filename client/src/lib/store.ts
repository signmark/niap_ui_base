import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string | null, userId: string | null) => void;
  clearAuth: () => void;
  getAuthToken: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: localStorage.getItem('auth_token') || null,
      userId: localStorage.getItem('user_id') || null,
      isAuthenticated: !!(localStorage.getItem('auth_token') && localStorage.getItem('user_id')),
      setAuth: (token, userId) => {
        // Сохраняем токен и userId в localStorage для прямого доступа
        if (token) {
          localStorage.setItem('auth_token', token);
        } else {
          localStorage.removeItem('auth_token');
        }
        
        if (userId) {
          localStorage.setItem('user_id', userId);
        } else {
          localStorage.removeItem('user_id');
        }

        console.log(`Сохранение авторизации: token=${!!token}, userId=${userId}`);
        set({ 
          token, 
          userId, 
          isAuthenticated: !!token && !!userId,
        });
      },
      clearAuth: () => {
        console.log('Очистка данных авторизации');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('refresh_token');
        set({ 
          token: null, 
          userId: null, 
          isAuthenticated: false,
        });
      },
      getAuthToken: () => {
        // Получить действующий токен авторизации
        const state = get();
        const token = state.token || localStorage.getItem('auth_token');
        if (!token) {
          console.log('Токен авторизации не найден');
        }
        return token;
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);

// Интерфейс для состояния выбранной кампании
interface CampaignState {
  selectedCampaignId: string | null;
  selectedCampaignName: string | null;
  setSelectedCampaign: (id: string, name: string) => void;
  clearSelectedCampaign: () => void;
}

// Хранилище для выбранной кампании
export const useCampaignStore = create<CampaignState>()(
  persist(
    (set) => ({
      selectedCampaignId: localStorage.getItem('selected_campaign_id') || null,
      selectedCampaignName: localStorage.getItem('selected_campaign_name') || null,
      setSelectedCampaign: (id, name) => {
        // Сохраняем ID и название кампании в localStorage для быстрого доступа
        localStorage.setItem('selected_campaign_id', id);
        localStorage.setItem('selected_campaign_name', name);
        
        console.log(`Установлена активная кампания: id=${id}, name=${name}`);
        set({ selectedCampaignId: id, selectedCampaignName: name });
      },
      clearSelectedCampaign: () => {
        console.log('Очистка данных о выбранной кампании');
        localStorage.removeItem('selected_campaign_id');
        localStorage.removeItem('selected_campaign_name');
        set({ selectedCampaignId: null, selectedCampaignName: null });
      }
    }),
    {
      name: 'campaign-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        selectedCampaignId: state.selectedCampaignId,
        selectedCampaignName: state.selectedCampaignName
      }),
    }
  )
);