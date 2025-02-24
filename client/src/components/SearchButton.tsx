
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from './ui/button';

export function SearchButton({ keywords }: { keywords: string[] }) {
  const queryClient = useQueryClient();
  
  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      if (!res.ok) throw new Error('Search failed');
    },
    onSuccess: () => {
      // Set timer to refresh results after 10 seconds
      setTimeout(() => {
        queryClient.invalidateQueries(['campaign_links']);
      }, 10000);
    },
  });

  return (
    <Button 
      onClick={() => searchMutation.mutate()}
      disabled={searchMutation.isLoading}
    >
      <Search className="mr-2 h-4 w-4" />
      Search Keywords
    </Button>
  );
}
