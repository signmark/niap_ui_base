import { create } from 'zustand';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  status?: string;
  date_created?: string;
  date_updated?: string;
}

interface CampaignStore {
  activeCampaign: Campaign | null;
  campaigns: Campaign[];
  setActiveCampaign: (campaign: Campaign | null) => void;
  setCampaigns: (campaigns: Campaign[]) => void;
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  removeCampaign: (id: string) => void;
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  activeCampaign: null,
  campaigns: [],
  
  setActiveCampaign: (campaign) => set({ activeCampaign: campaign }),
  
  setCampaigns: (campaigns) => set({ campaigns }),
  
  addCampaign: (campaign) => set((state) => ({
    campaigns: [...state.campaigns, campaign]
  })),
  
  updateCampaign: (id, updates) => set((state) => ({
    campaigns: state.campaigns.map(campaign =>
      campaign.id === id ? { ...campaign, ...updates } : campaign
    ),
    activeCampaign: state.activeCampaign?.id === id 
      ? { ...state.activeCampaign, ...updates }
      : state.activeCampaign
  })),
  
  removeCampaign: (id) => set((state) => ({
    campaigns: state.campaigns.filter(campaign => campaign.id !== id),
    activeCampaign: state.activeCampaign?.id === id ? null : state.activeCampaign
  }))
}));