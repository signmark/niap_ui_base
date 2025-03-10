import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Campaign {
  id: string;
  name: string;
  description?: string;
}

interface CampaignState {
  selectedCampaign: Campaign | null;
  setSelectedCampaign: (campaign: Campaign | null) => void;
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set) => ({
      selectedCampaign: null,
      setSelectedCampaign: (campaign) => set({ selectedCampaign: campaign }),
    }),
    {
      name: 'campaign-storage',
    }
  )
);