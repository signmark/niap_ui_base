import { create } from 'zustand';

interface StoriesDialogState {
  imageDialogOpen: boolean;
  contentId: string | null;
  pendingElementType: string | null;
  
  // Actions
  openImageDialog: (contentId: string, elementType?: string) => void;
  closeImageDialog: () => void;
  setContentId: (id: string) => void;
}

export const useStoriesDialogStore = create<StoriesDialogState>((set) => ({
  imageDialogOpen: false,
  contentId: null,
  pendingElementType: 'image',
  
  openImageDialog: (contentId: string, elementType = 'image') => {
    set({ 
      imageDialogOpen: true, 
      contentId,
      pendingElementType: elementType 
    });
  },
  
  closeImageDialog: () => {
    set({ 
      imageDialogOpen: false, 
      contentId: null,
      pendingElementType: null 
    });
  },
  
  setContentId: (id: string) => {
    set({ contentId: id });
  },
}));