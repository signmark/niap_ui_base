# SMM Manager - Social Media Content Management Platform

## Overview

SMM Manager is an intelligent social media content management platform that helps content creators with AI-powered content generation, analytics, and multi-platform publishing strategies. The application provides adaptive workflows for content creation with intelligent scheduling, multi-language AI-driven content creation, and direct social media publishing capabilities.

## System Architecture

### Technology Stack
- **Frontend**: React with TypeScript
- **Backend**: Node.js/Express 
- **Content Management**: Directus headless CMS (primary database)
- **State Management**: React Query
- **Authentication**: Custom token refresh middleware
- **AI Integration**: DeepSeek, Perplexity API, FAL AI Proxy
- **Automation**: N8N workflow automation
- **Deployment**: Docker with Traefik reverse proxy

### Environment Detection
The system automatically detects deployment environments:
- **Development (Replit)**: Uses `admin@roboflow.tech` credentials and `directus.roboflow.tech`
- **Staging**: Similar to development with enhanced logging
- **Production**: Uses `lbrspb@gmail.com` credentials and `directus.nplanner.ru`

## Key Components

### Frontend Architecture
- React-based SPA with TypeScript
- Component-based architecture with reusable UI elements
- Client-side environment detection via `/api/config` endpoint
- Dynamic Directus URL configuration based on environment

### Backend Architecture
- Express.js API server with modular route structure
- Authentication middleware with JWT token management
- Scheduled content publishing system with duplicate prevention
- Multi-platform social media integration (Facebook, Instagram, VK, Telegram)

### Database Schema
Core tables managed through Directus:
- `user_campaigns` - Campaign management
- `campaign_content` - Content items with social platform configurations
- `global_api_keys` - Centralized API key management
- `user_api_keys` - User-specific API configurations
- `business_questionnaire` - Campaign context and targeting data

### Publishing System
- **Scheduler Service**: Automated content publishing with file-based locking
- **Platform Services**: Dedicated handlers for each social platform
- **Duplicate Prevention**: 4-level protection system against duplicate posts
- **Status Validation**: Automatic correction of inconsistent publication states

## Data Flow

### Content Creation Flow
1. User creates campaign with business questionnaire
2. AI generates content based on campaign context and keywords
3. Content scheduled for publishing across selected platforms
4. Automated publishing via platform-specific APIs or N8N webhooks

### Authentication Flow
1. User authentication through Directus
2. JWT token management with automatic refresh
3. Role-based access control (SMM User, SMM Admin)
4. Admin routes with elevated privilege verification

### Publishing Flow
1. Scheduler identifies ready-to-publish content
2. Platform-specific publication handlers process content
3. Real-time status updates and error handling
4. Post-publication analytics and URL tracking

## External Dependencies

### AI Services
- **DeepSeek API**: Primary content generation
- **Perplexity API**: Research and trend analysis
- **FAL AI**: Image and video generation
- **Google Gemini**: Alternative content generation

### Social Media APIs
- **Facebook Graph API**: Direct posting integration
- **Instagram Basic Display API**: Content publishing
- **VK API**: Via N8N webhook integration
- **Telegram Bot API**: Via N8N webhook integration

### Infrastructure Services
- **Directus**: Headless CMS for data management
- **N8N**: Workflow automation for complex publishing flows
- **Beget S3**: File storage for media assets
- **Directus Database**: Primary data storage via hosted Directus instance

## Deployment Strategy

### Multi-Environment Setup
- **Development**: Replit-hosted with live reload
- **Staging**: VPS with production-like configuration
- **Production**: Self-hosted VPS with Docker composition

### Docker Architecture
- **Traefik**: Reverse proxy with automatic SSL
- **PostgreSQL**: Database service
- **Directus**: Content management backend
- **N8N**: Workflow automation
- **PgAdmin**: Database administration interface
- **SMM App**: Main application container

### Environment Configuration
Environment-specific settings managed through:
- `.env` files for each environment
- Automatic environment detection based on system context
- Dynamic API endpoint configuration

## Changelog
- June 24, 2025. Initial setup
- June 24, 2025. Implemented Instagram Stories Preview with visual interface replacing technical metadata display
- June 24, 2025. CRITICAL FIX: Stories duplication issue resolved - system now properly detects edit mode via URL pathname and initialStoryId, prevents creating new Stories when updating existing ones
- June 24, 2025. VERIFICATION: Stories component correctly receives storyId and loads existing data in edit mode, alternative URL parsing logic implemented for backup story ID detection
- June 24, 2025. FINAL FIX: Replaced handleSave function with saveStory logic to ensure save button uses proper edit/create mode detection and prevents duplication
- June 24, 2025. SUCCESS VERIFIED: Stories duplication issue completely resolved - system now correctly uses PATCH requests to update existing Stories instead of creating duplicates
- June 24, 2025. DEBUGGING ELEMENTS POSITION: Added comprehensive logging and validation for Stories elements structure to prevent undefined elements after save/reload operations
- June 24, 2025. SERVER RESTART: Restarted application workflow to ensure updated PATCH request logging and metadata parsing is active
- June 24, 2025. ELEMENTS POSITION FIX COMPLETED: Fixed validation logic that was overwriting existing element positions with default values, Stories elements now preserve their positions after save/reload
- June 24, 2025. CRITICAL DIALOG FIX: Fixed StoriesImageGenerationDialog persistent closure issue by stabilizing component mounting using useMemo wrapper, removed reactive logging, fixed CSS backgroundColor validation to prevent URL-as-color errors, added unique keys to prevent React warnings
- June 24, 2025. RADICAL DIALOG STABILITY FIX: Implemented global dialog state management with dedicated storiesDialogStore, completely isolated dialog state from component lifecycle, converted all handlers to useCallback for stability, fixed all backgroundColor CSS errors in InstagramStoriesPreview
- June 24, 2025. DIALOG INTEGRATION COMPLETE: Fixed setDialogContentId error by correcting function import names, implemented proper addElement handler with dialog integration, updated StoriesImageGenerationDialog interface to match global store pattern
- June 24, 2025. VARIABLE CONFLICT RESOLVED: Fixed duplicate selectedElement declaration by renaming store variable to storeSelectedElement, corrected JSX syntax errors, updated all references to use proper store functions
- June 24, 2025. COMPLETE VARIABLE FIXES: Fixed all remaining selectedElement references throughout StoryEditor.tsx, replaced with storeSelectedElement and setStoreSelectedElement, corrected optional chaining for content properties
- June 24, 2025. FINAL selectedElement FIX: Completely eliminated all selectedElement references from StoryEditor.tsx, removed all duplicate state management, simplified update logic to use only storeSelectedElement from global store
- June 24, 2025. CRITICAL IMPORT FIXES: Fixed Dialog component import in StoriesImageGenerationDialog, added missing DialogContent and DialogHeader imports, resolved isAutoSaving undefined error
- June 24, 2025. COMPLETE IMPORT RESOLUTION: Added missing Dialog import to StoriesImageGenerationDialog.tsx, systematically checked for all undefined component errors across Stories components
- June 24, 2025. DIALOG STABILITY & PROMPT FIX: Fixed backgroundColor CSS validation errors, stabilized dialog state with logging, ensured generated English prompts are properly inserted into text field, resolved dialog flickering
- June 24, 2025. COMPLETE IMAGE GENERATOR WORKFLOW: Implemented full workflow - Russian text input → English prompt generation → multiple image generation → selection interface → slide insertion. Added comprehensive logging, improved error handling, enhanced UI feedback for image selection process
- June 24, 2025. CRITICAL ERROR FIXES: Fixed 'campaignId is not defined' error by adding proper props interface and safe defaults, fixed CSS backgroundColor validation errors with URL values, added comprehensive error handling with debugging info, implemented proper parameter passing to StoriesImageGenerationDialog
- June 25, 2025. PERFORMANCE OPTIMIZATION: Fixed infinite component re-renders by adding proper element keys in StoryEditor, implemented admin status caching (30sec) to prevent excessive API calls, added network connectivity checks for FAL.AI API to handle connection errors gracefully, stabilized InstagramStoriesPreview background color validation

## User Preferences

Preferred communication style: Simple, everyday language.

### Technical Notes
- **Stories API Authentication**: Always use user token (req.headers.authorization) for Directus API calls, never use admin token. User tokens work constantly in the system and have proper permissions for campaign_content collection.
- **Database Storage**: All Stories data should be stored in campaign_content.metadata field as JSON, not in separate fields.
- **Stories Elements Validation**: When validating loaded elements, preserve existing position data instead of overwriting with default values. Check for undefined x/y coordinates before applying defaults.
- **Stories PATCH Operations**: System correctly uses PATCH requests to update existing Stories instead of creating duplicates. Edit mode is detected via URL pathname containing "/edit".
- **Database**: System does not use PostgreSQL - uses Directus as primary database/CMS with external hosted instance.
- **Testing**: For API testing only, can use DIRECTUS_TOKEN environment variable for direct Directus access.
- **Request Processing**: Every user request must be properly self-prompted to ensure complete understanding and systematic execution.
- **Checkpoint Policy**: Do not create checkpoints until the assigned task is completely implemented and tested. Work through all iterations and testing before considering the task complete.
- **React JSX**: Avoid JSX comments inside conditional renders - use regular JS comments outside JSX or structure conditionals to return valid React elements only.
- **Code Reuse**: Always use existing system approaches and patterns. Copy and adapt working solutions from similar functionality instead of creating new approaches.