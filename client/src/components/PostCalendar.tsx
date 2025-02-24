
import React from 'react';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function PostCalendar() {
  const [date, setDate] = React.useState<Date>();
  const [content, setContent] = React.useState('');
  const [mediaUrl, setMediaUrl] = React.useState('');
  const queryClient = useQueryClient();

  const createPost = useMutation({
    mutationFn: async (data: { date: Date; content: string; mediaUrl: string }) => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create post');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['posts']);
    },
  });

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        className="rounded-md border"
      />

      <Dialog>
        <DialogTrigger asChild>
          <Button>Create Post</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Post content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Input
              placeholder="Media URL"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
            <Button 
              onClick={() => createPost.mutate({ date: date!, content, mediaUrl })}
              disabled={!date || !content || createPost.isLoading}
            >
              Schedule Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
