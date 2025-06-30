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
- June 25, 2025. Implemented smooth navigation for Stories editor using wouter router, eliminating full page reloads
- June 25, 2025. Fixed Stories creation and element management: resolved disappearing elements issue, implemented clean Stories creation through content type dialog, and improved store state management
- June 25, 2025. Fixed Stories navigation to use clean /stories/new route without query parameters, resolved campaign_id validation errors, and implemented comprehensive localStorage clearing for new Stories creation
- June 25, 2025. Removed "Видео редактор" and "Stories Canvas" menu items, unified all content management through main content interface
- June 25, 2025. Integrated video thumbnail support into Additional Images field in Directus: thumbnails now save to additional_images array (first position) instead of separate field, with AI generation support
- June 25, 2025. Fixed video thumbnail AI generation: both create and edit mode "Сгенерировать обложку" buttons now properly set videoThumbnailMode flag and auto-populate thumbnail URL field
- June 25, 2025. Added video thumbnail display in content preview dialog: thumbnails now show alongside video player with proper styling and error handling
- June 25, 2025. Implemented YouTube OAuth2 integration: added Google Cloud OAuth setup with proper redirect handling, YouTube service for video uploads, callback page for auth flow, and environment variables configuration
- June 25, 2025. Completed YouTube OAuth integration into campaign social media settings: OAuth tokens now save to campaign's social_media_settings JSON field, added clear interface explanations for required API Key, Channel ID, and OAuth tokens
- June 25, 2025. Finalized YouTube publishing integration: scheduler now properly handles YouTube content with failed/pending status, fixed parameter passing between scheduler and YouTube service, implemented direct API publishing (not webhook), and enabled automatic retry logic for failed YouTube publications
- June 27, 2025. Successfully tested YouTube integration end-to-end: all components work correctly including OAuth2 setup, video download/processing, and YouTube API communication. Integration ready for production use with valid OAuth tokens.
- June 27, 2025. YouTube OAuth2 authorization fully completed: fixed callback token saving, created YouTubeOAuth utility class, resolved all constructor and state parameter issues. New access and refresh tokens successfully saved to campaign settings. YouTube publishing now ready for production use.
- June 27, 2025. YouTube publishing integration fully tested and working: successfully published test video (ID: TuK26D_Qfyg) to YouTube channel UC_Z5lVPGWcpmwEZAkOd_JSA via direct API call. All components verified including OAuth2 tokens, video upload, and database status updates. YouTube integration production-ready.
- June 27, 2025. Fixed YouTube thumbnail/cover image upload: added thumbnail support to YouTube service, videos now publish with generated cover images from videoThumbnail or additional_images fields. Fixed data mapping between scheduler and YouTube service to properly pass campaign settings.
- June 27, 2025. Updated content creation interface: renamed "Контент" → "Описание" throughout the interface. YouTube platform now available ONLY for video content type with proper validation.
- June 27, 2025. Fixed ContentTypeDialog to show all content types with proper names: "Обычный пост", "Instagram Stories", "Видео" while maintaining YouTube video-only restriction through PlatformSelector validation.
- June 27, 2025. Implemented detailed content type structure: "Текст", "Текст с картинкой", "Видео", "Instagram Stories" with dynamic field labeling - video content uses "Описание" and "Теги", text content uses "Контент" and "Ключевые слова". Fixed automatic content type selection from ContentTypeDialog to form fields.
- June 27, 2025. Fixed platform selection system: added YouTube to available platforms, removed default platform selection (all platforms now start unchecked), and implemented instant dialog closure on "Publish Now" button click to prevent duplicate submissions.
- June 27, 2025. Fixed YouTube disappearing from platform list after publication: added YouTube to supported platforms in social-publishing-router.ts, created direct API handler for YouTube publications, and ensured YouTube status is properly preserved in database responses.
- June 27, 2025. Fixed YouTube publication results not saving to database: enhanced YouTube service to return complete status data (status, postUrl, platform, publishedAt, videoId) and updated publish-scheduler to properly save YouTube results to social_platforms field in database.
- June 29, 2025. Fixed critical React hooks violation error: removed conditional useCallback usage that violated Rules of Hooks, eliminated conditional enabled flags from useQuery hooks, and stabilized content editing interface. Application now runs without hook-related crashes and supports full content type editing including "Текст с картинкой" option.
- June 30, 2025. Fixed critical social media settings bug: PATCH /api/campaigns/:id endpoint now properly merges existing social platform settings with new ones instead of replacing them. Fixed token declaration issue and collection name error. Users can now safely configure individual platforms without losing settings for other platforms.
- June 30, 2025. Fixed YouTube OAuth integration: updated REDIRECT_URI to current Replit domain, added fallback for expired state parameters, and successfully completed end-to-end OAuth flow. YouTube publishing now fully operational with valid access and refresh tokens saved to campaign settings.
- June 30, 2025. Implemented quota_exceeded status handling: added comprehensive blocking logic to prevent retry loops when API quotas are exceeded. System now treats quota_exceeded status same as published for blocking duplicate attempts while preserving original status. Enhanced error handling with intelligent retry prevention across all social services.
- June 30, 2025. Optimized scheduler token management: Planning scheduler now uses static environment tokens (DIRECTUS_TOKEN/DIRECTUS_ADMIN_TOKEN) directly instead of dynamic token management. UI completely isolated from admin tokens. Eliminated authentication errors and cleaned server logs. Only scheduler and test scripts use admin tokens.
- June 30, 2025. Fixed critical expired token handling: Implemented aggressive token expiration checks in queryClient.ts, store.ts, and App.tsx. System now automatically detects expired tokens, clears localStorage/sessionStorage, and redirects to login page. Added 1-second interval checking to force logout when tokens expire. Eliminated 401 errors from expired user tokens in server logs.
- June 30, 2025. Fixed critical URL formatting and token usage issues: Resolved double slash problem in API URLs (//users/me → /users/me) by sanitizing DIRECTUS_URL. Fixed Global API Keys Service to use static environment tokens instead of user tokens. Ensured strict separation: static tokens for server operations (scheduler, system tasks), user tokens only for UI operations. Achieved clean server logs without authorization errors.

## User Preferences

Preferred communication style: Simple, everyday language.

### Technical Notes
- **Stories API Authentication**: Always use user token (req.headers.authorization) for Directus API calls, never use admin token. User tokens work constantly in the system and have proper permissions for campaign_content collection.
- **Database Storage**: All Stories data should be stored in campaign_content.metadata field as JSON, not in separate fields.
- **Database**: System does not use PostgreSQL - uses Directus as primary database/CMS with external hosted instance.
- **Testing**: For API testing only, can use DIRECTUS_TOKEN environment variable for direct Directus access.
- **Request Processing**: Every user request must be properly self-prompted to ensure complete understanding and systematic execution.
- **React JSX**: Avoid JSX comments inside conditional renders - use regular JS comments outside JSX or structure conditionals to return valid React elements only.
- **Stories Store Management**: Stories creation through /stories/new route automatically clears localStorage and resets store state. System ensures clean slate for new Stories without old content interference.
- **Stories Navigation**: All Stories creation routes use simple /stories/new path without query parameters. localStorage clearing is handled internally by StoryEditor component.