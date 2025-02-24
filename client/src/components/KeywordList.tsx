
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface Keyword {
  id: string;
  keyword: string;
  trend_score: number;
}

export function KeywordList({ keywords }: { keywords: Keyword[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/keywords/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete keyword');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['keywords']);
      toast({
        title: 'Success',
        description: 'Keyword deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete keyword',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="space-y-2">
      {keywords.map((keyword) => (
        <div key={keyword.id} className="flex items-center justify-between p-2 bg-white rounded shadow">
          <div className="flex items-center gap-4">
            <span>{keyword.keyword}</span>
            <span className="text-sm text-gray-500">Trend: {keyword.trend_score}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteKeyword.mutate(keyword.id)}
            disabled={deleteKeyword.isLoading}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ))}
    </div>
  );
}
