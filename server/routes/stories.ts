import { Router } from 'express';
import { z } from 'zod';
import { directusStorageAdapter } from '../services/directus-storage-adapter';
import { log } from '../utils/logger';
import { directusApi } from '../lib/directus';

// Authentication middleware using the same pattern as other routes
const authenticateUser = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No valid token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Validate token with Directus
      const response = await directusApi.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data?.data?.id) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      }

      req.user = {
        id: response.data.data.id,
        token: token,
        email: response.data.data.email
      };
      
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Authentication error' });
  }
};
import {
  insertStoryContentSchema,
  insertStorySlideSchema,
  insertStoryElementSchema,
  StoryContent,
  StorySlide,
  StoryElement
} from '../../shared/stories-schema';

const router = Router();

// Create new story
router.post('/stories', authenticateUser, async (req, res) => {
  try {
    const storyData = {
      ...req.body,
      userId: req.user.id
    };

    const story = await directusStorageAdapter.createStory(storyData);
    log(`Created new story: ${story.id}`, 'stories');

    res.json({ success: true, data: story });
  } catch (error: any) {
    log(`Error creating story: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get story by ID
router.get('/stories/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const story = await directusStorageAdapter.getStoryById(id, req.user.id);
    
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    res.json({ success: true, data: story });
  } catch (error: any) {
    log(`Error fetching story: ${error.message}`, 'stories');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update story
router.put('/stories/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedStory = await storage.updateStory(id, updateData, req.user.id);
    
    if (!updatedStory) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    log(`Updated story: ${id}`, 'stories');
    res.json({ success: true, data: updatedStory });
  } catch (error: any) {
    log(`Error updating story: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete story
router.delete('/stories/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await directusStorageAdapter.deleteStory(id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    log(`Deleted story: ${id}`, 'stories');
    res.json({ success: true, message: 'Story deleted successfully' });
  } catch (error: any) {
    log(`Error deleting story: ${error.message}`, 'stories');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all stories for a campaign
router.get('/campaigns/:campaignId/stories', authenticateUser, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const stories = await directusStorageAdapter.getStoriesByCampaign(campaignId, req.user.id);

    res.json({ success: true, data: stories });
  } catch (error: any) {
    log(`Error fetching campaign stories: ${error.message}`, 'stories');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add slide to story
router.post('/stories/:id/slides', authenticateUser, async (req, res) => {
  try {
    const { id: storyId } = req.params;
    const slideData = insertStorySlideSchema.parse({
      ...req.body,
      storyId
    });

    const slide = await directusStorageAdapter.addSlideToStory(slideData, req.user.id);
    log(`Added slide to story ${storyId}: ${slide.id}`, 'stories');

    res.json({ success: true, data: slide });
  } catch (error: any) {
    log(`Error adding slide: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update slide
router.put('/stories/:storyId/slides/:slideId', authenticateUser, async (req, res) => {
  try {
    const { storyId, slideId } = req.params;
    const updateData = req.body;

    const updatedSlide = await storage.updateSlide(slideId, updateData, req.user.id);
    
    if (!updatedSlide) {
      return res.status(404).json({ success: false, error: 'Slide not found' });
    }

    log(`Updated slide ${slideId} in story ${storyId}`, 'stories');
    res.json({ success: true, data: updatedSlide });
  } catch (error: any) {
    log(`Error updating slide: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete slide
router.delete('/stories/:storyId/slides/:slideId', authenticateUser, async (req, res) => {
  try {
    const { storyId, slideId } = req.params;
    const deleted = await storage.deleteSlide(slideId, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Slide not found' });
    }

    log(`Deleted slide ${slideId} from story ${storyId}`, 'stories');
    res.json({ success: true, message: 'Slide deleted successfully' });
  } catch (error: any) {
    log(`Error deleting slide: ${error.message}`, 'stories');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reorder slides
router.post('/stories/:id/slides/reorder', authenticateUser, async (req, res) => {
  try {
    const { id: storyId } = req.params;
    const { slideIds } = req.body; // Array of slide IDs in new order

    if (!Array.isArray(slideIds)) {
      return res.status(400).json({ success: false, error: 'slideIds must be an array' });
    }

    await storage.reorderSlides(storyId, slideIds, req.user.id);
    log(`Reordered slides for story ${storyId}`, 'stories');

    res.json({ success: true, message: 'Slides reordered successfully' });
  } catch (error: any) {
    log(`Error reordering slides: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Add element to slide
router.post('/stories/:storyId/slides/:slideId/elements', authenticateUser, async (req, res) => {
  try {
    const { slideId } = req.params;
    const elementData = insertStoryElementSchema.parse({
      ...req.body,
      slideId
    });

    const element = await storage.addElementToSlide(elementData, req.user.id);
    log(`Added element to slide ${slideId}: ${element.id}`, 'stories');

    res.json({ success: true, data: element });
  } catch (error: any) {
    log(`Error adding element: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update element
router.put('/stories/:storyId/slides/:slideId/elements/:elementId', authenticateUser, async (req, res) => {
  try {
    const { elementId } = req.params;
    const updateData = req.body;

    const updatedElement = await storage.updateElement(elementId, updateData, req.user.id);
    
    if (!updatedElement) {
      return res.status(404).json({ success: false, error: 'Element not found' });
    }

    log(`Updated element ${elementId}`, 'stories');
    res.json({ success: true, data: updatedElement });
  } catch (error: any) {
    log(`Error updating element: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete element
router.delete('/stories/:storyId/slides/:slideId/elements/:elementId', authenticateUser, async (req, res) => {
  try {
    const { elementId } = req.params;
    const deleted = await storage.deleteElement(elementId, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Element not found' });
    }

    log(`Deleted element ${elementId}`, 'stories');
    res.json({ success: true, message: 'Element deleted successfully' });
  } catch (error: any) {
    log(`Error deleting element: ${error.message}`, 'stories');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Schedule story publication
router.post('/stories/:id/schedule', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt, platformSettings } = req.body;

    const scheduledStory = await storage.scheduleStory(id, scheduledAt, platformSettings, req.user.id);
    
    if (!scheduledStory) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    log(`Scheduled story ${id} for ${scheduledAt}`, 'stories');
    res.json({ success: true, data: scheduledStory });
  } catch (error: any) {
    log(`Error scheduling story: ${error.message}`, 'stories');
    res.status(400).json({ success: false, error: error.message });
  }
});

// Publish story immediately
router.post('/stories/:id/publish', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { platforms } = req.body;

    // Integration with existing publication system would go here
    log(`Publishing story ${id} to platforms: ${platforms?.join(', ') || 'all'}`, 'stories');
    
    res.json({ success: true, message: 'Story publication initiated' });
  } catch (error: any) {
    log(`Error publishing story: ${error.message}`, 'stories');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get story preview for publication
router.get('/stories/:id/preview', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const story = await storage.getStoryById(id, req.user.id);
    
    if (!story) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    // Generate preview data for publication
    const preview = {
      id: story.id,
      title: story.title,
      slideCount: story.slides?.length || 0,
      totalDuration: story.slides?.reduce((sum, slide) => sum + slide.duration, 0) || 0,
      thumbnails: story.slides?.map(slide => ({
        slideId: slide.id,
        order: slide.order,
        thumbnail: generateSlideThumbnail(slide) // Would generate actual thumbnail
      })) || []
    };

    res.json({ success: true, data: preview });
  } catch (error: any) {
    log(`Error generating story preview: ${error.message}`, 'stories');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to generate slide thumbnail (placeholder)
function generateSlideThumbnail(slide: StorySlide): string {
  // This would generate an actual thumbnail based on slide content
  return `/api/stories/thumbnails/${slide.id}`;
}

export default router;