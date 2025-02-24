
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface SearchButtonProps {
  keywords: string[];
  campaignId: string;
}

export function SearchButton({ keywords, campaignId }: SearchButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, campaignId }),
      });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Search started',
        description: 'Results will be updated in 10 seconds',
      });
      setIsRefreshing(true);
      setTimeout(() => {
        queryClient.invalidateQueries(['campaign_links', campaignId]);
        setIsRefreshing(false);
      }, 10000);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to start search',
        variant: 'destructive',
      });
    },
  });

  return (
    <Button 
      onClick={() => searchMutation.mutate()}
      disabled={searchMutation.isLoading || isRefreshing || keywords.length === 0}
      className="w-full md:w-auto"
    >
      {searchMutation.isLoading || isRefreshing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isRefreshing ? 'Refreshing...' : 'Searching...'}
        </>
      ) : (
        <>
          <Search className="mr-2 h-4 w-4" />
          Search Keywords
        </>
      )}
    </Button>
  );
}
