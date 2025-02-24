
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Button } from './ui/button';

interface Keyword {
  id: string;
  name: string;
}

export function KeywordList({ keywords }: { keywords: Keyword[] }) {
  const queryClient = useQueryClient();
  
  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/keywords/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete keyword');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['keywords']);
    },
  });

  return (
    <div className="space-y-2">
      {keywords.map((keyword) => (
        <div key={keyword.id} className="flex items-center justify-between p-2 bg-white rounded shadow">
          <span>{keyword.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteKeyword.mutate(keyword.id)}
            disabled={deleteKeyword.isLoading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
