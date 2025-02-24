
import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

interface Post {
  id: string;
  date: string;
  content: string;
  mediaUrl?: string;
}

interface PostCalendarProps {
  campaignId: string;
  posts: Post[];
}

export function PostCalendar({ campaignId, posts }: PostCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createPost = useMutation({
    mutationFn: async (postData: { date: Date; content: string; mediaUrl?: string }) => {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...postData, campaignId }),
      });
      if (!res.ok) throw new Error('Failed to create post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['posts', campaignId]);
      setIsOpen(false);
      setContent('');
      setMediaUrl('');
      toast({
        title: 'Success',
        description: 'Post created successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create post',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedDate || !content) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    createPost.mutate({ date: selectedDate, content, mediaUrl });
  };

  return (
    <div className="space-y-4">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Post
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
            <Textarea
              placeholder="Post content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Input
              placeholder="Media URL (optional)"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
            <Button 
              onClick={handleSubmit}
              disabled={createPost.isLoading}
              className="w-full"
            >
              {createPost.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Post'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
        className="rounded-md border"
        modifiers={{
          booked: posts.map(post => new Date(post.date)),
        }}
        modifiersStyles={{
          booked: { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
        }}
      />
    </div>
  );
}
