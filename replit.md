# SMM Manager - Social Media Content Management Platform

## Overview
SMM Manager is an intelligent social media content management platform designed for content creators. It provides AI-powered content generation, analytics, and multi-platform publishing strategies. The application offers adaptive workflows for content creation, intelligent scheduling, multi-language AI-driven content generation, and direct social media publishing capabilities. The project aims to streamline social media content management and enhance content creator efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
- **2025-08-01**: **FIXED CROSS-PLATFORM OAUTH TOKEN SYNCHRONIZATION** - Resolved critical bug where OAuth tokens didn't automatically update in form fields
- **2025-08-01**: Enhanced Instagram OAuth with automatic postMessage handling and form field updates
- **2025-08-01**: Fixed VK OAuth workflow - added proper message listener and corrected redirect URI to use local callback page
- **2025-08-01**: Improved parent-child component communication between setup wizards and main settings form
- **2025-08-01**: Added custom event dispatching for Instagram settings updates with automatic form synchronization
- **2025-08-01**: Fixed YouTube OAuth workflow - resolved "Not Found" errors for users without YouTube channels
- **2025-08-01**: Added comprehensive YouTube channel creation instructions with clickable links
- **2025-08-01**: Cleaned up YouTube API logging to reduce console noise while maintaining error handling
- **2025-08-01**: Improved YouTube wizard UX with clear step-by-step guidance for channel setup
- **2025-08-01**: Fixed image generation system to use global API keys from database instead of user-specific keys
- **2025-08-01**: Updated site analysis to use direct Gemini API with GEMINI_API_KEY environment variable
- **2025-08-01**: Implemented universal API key search supporting both uppercase and lowercase service names for maximum compatibility
- **2025-08-01**: **IMPLEMENTED COMPREHENSIVE TESTING INFRASTRUCTURE** - Created extensive Jest-based test suite covering Facebook token validation, YouTube OAuth flow, and system utilities (40 new tests total)

### Technical Notes
- **Stories API Authentication**: Always use user token (req.headers.authorization) for Directus API calls, never use admin token. User tokens work constantly in the system and have proper permissions for campaign_content collection.
- **Database Storage**: All Stories data should be stored in campaign_content.metadata field as JSON, not in separate fields.
- **Database**: System does not use PostgreSQL - uses Directus as primary database/CMS with external hosted instance.
- **Testing & Scheduler**: DIRECTUS_TOKEN environment variable can be used for:
  - API testing and development scripts
  - Scheduler operations and automated tasks
  - Direct Directus API access when user tokens unavailable
  - Website analysis and other server-side operations
- **Request Processing**: Every user request must be properly self-prompted to ensure complete understanding and systematic execution.
- **DEBUG PHILOSOPHY**: ВСЕГДА ИЩИТЕ ПРОБЛЕМЫ В КОДЕ ПЕРВУЮ ОЧЕРЕДЬ, а не в сервисах/API. API работают - ищите баги в логике, кэше, выполнении кода. Промптируйте себя правильно для поиска багов в коде.
- **Production Code Quality**: All debug artifacts (console.log statements, UI debug information, temporary development text) must be completely removed before production deployment. System maintains clean, professional interface without any visible debug elements.
- **CRITICAL RECURRING BUGS TO CHECK FIRST**:
  - **Comments API Field Names**: Collection `post_comment` uses field `trent_post_id` (NOT `trend_id`), sorting by `date` (NOT `date_created`)
  - **Comments API Authorization**: Use user token from headers, NOT system token. Check token validity first.
  - **Website Analysis Performance**: extractFullSiteContent functions ALWAYS hang server with regex forEach loops - replace with for loops, 8000ms timeout, 2MB limit
  - **Platform Field Names**: Always verify actual database field names in Directus admin before writing API queries
  - **403 Errors**: Usually wrong field names or collection permissions, NOT authentication issues
- **TOKEN USAGE RULES**:
  - **UI/Frontend**: ALWAYS use user tokens from headers/authorization for ALL user-facing operations
  - **System Operations**: System tokens (DIRECTUS_TOKEN) ONLY for scheduler, automated tasks, and backend operations NOT triggered by user
  - **Mixed Operations**: If API needs both user verification AND system access, verify user token first, then use system token for restricted collections
- **React JSX**: Avoid JSX comments inside conditional renders - use regular JS comments outside JSX or structure conditionals to return valid React elements only.
- **Stories Store Management**: Stories creation through /stories/new route automatically clears localStorage and resets store state. System ensures clean slate for new Stories without old content interference.
- **Stories Navigation**: All Stories creation routes use simple /stories/new path without query parameters. localStorage clearing is handled internally by StoryEditor component.
- **CRITICAL SITE ANALYSIS PERFORMANCE ISSUE**: The extractFullSiteContent functions in server/routes.ts ALWAYS cause server hangs due to regex forEach loops and long HTTP timeouts. When this issue appears:
  1. Find ALL extractFullSiteContent functions (there are multiple)
  2. Replace ALL forEach loops with for loops with Math.min() limits
  3. Set axios timeout to 8000ms MAX, maxContentLength to 2MB
  4. Add content length limits (20KB) with truncation
  5. Never use while loops with regex.exec() - they cause infinite loops
  6. This is a recurring problem that needs immediate fixing when reported

## System Architecture

### Technology Stack
- **Frontend**: React with TypeScript
- **Backend**: Node.js/Express
- **Content Management**: Directus headless CMS
- **State Management**: React Query
- **Authentication**: Custom token refresh middleware
- **AI Integration**: Gemini (primary), FAL AI Proxy
- **Automation**: N8N workflow automation
- **Deployment**: Docker with Traefik reverse proxy

### Core Architectural Decisions
- **Monolithic to Modular Transition**: Ongoing effort to break down monolithic files (e.g., `routes.ts`) into modular components for better maintainability and scalability.
- **N8N-centric Publishing**: All social media platforms (YouTube, Facebook, Instagram, VK, Telegram) publish exclusively through N8N webhooks to ensure consistent architecture and centralized management. No direct API calls from the main application for publishing.
- **Comprehensive Duplicate Prevention**: A 4-level system prevents duplicate posts across platforms using `postUrl` checks, extended caching, a Publication Tracker service, and Lock Manager integration.
- **Intelligent Website Analysis**: A multi-tier fallback system for website analysis uses Gemini AI for content extraction and business questionnaire auto-filling. It prioritizes AI analysis and falls back to intelligent content-based classification if AI services fail.
- **Robust Authentication & Authorization**: JWT token management with automatic refresh and role-based access control (SMM User, SMM Admin). Strict separation of user tokens (for UI) and system tokens (for backend tasks).
- **Social Media API Wizards**: Guided setup wizards (e.g., for Instagram, YouTube, VK) simplify complex API configurations, including OAuth flows and token management, by automating steps and providing clear user guidance.
- **Dynamic Environment Detection**: The system automatically detects development (Replit), staging, and production environments to configure API endpoints and credentials accordingly.
- **Centralized API Key Management**: Global API keys for services like YouTube are stored in the database for centralized administration.

### Feature Specifications
- **AI-Powered Content Generation**: Utilizes AI for multi-language content creation based on campaign context.
- **Intelligent Scheduling**: Automated content publishing with duplicate prevention and status validation.
- **Multi-Platform Publishing**: Supports publishing to Facebook, Instagram, VK, Telegram, and YouTube.
- **Comment Collection & Sentiment Analysis**: Collects comments from social platforms and performs sentiment analysis using AI, with results stored in Directus.
- **Stories Editor**: Provides functionality for creating and editing Instagram Stories with element persistence and streamlined workflows.
- **Website Analysis for Business Questionnaire**: Automatically populates business questionnaire fields by analyzing website content and extracting relevant information.
- **Keyword Generation**: AI-driven keyword discovery and extraction from text and websites.

## External Dependencies

### AI Services
- **Gemini API (Google)**: Primary for content generation, research, trend analysis, sentiment analysis, website analysis, and keyword generation. All Gemini API calls use `GeminiProxyService` with a SOCKS5 proxy for geo-bypass.
- **FAL AI**: Used for image and video generation.

### Social Media APIs (via N8N)
- **Facebook Graph API**: For direct posting integration and Facebook page management.
- **Instagram Basic Display API**: For content publishing and account management.
- **VK API**: Integrated via N8N webhooks for publishing and comment collection.
- **Telegram Bot API**: Integrated via N8N webhooks for publishing and comment collection.
- **YouTube Data API**: For video uploads, metadata management, and token refresh, integrated via N8N workflows.

### Infrastructure Services
- **Directus**: Headless CMS used as the primary database for content, campaign data, user profiles, and API keys.
- **N8N**: Workflow automation tool critical for all social media publishing, token management, and complex backend flows.
- **Beget S3**: File storage for media assets.
- **PostgreSQL**: Database used by Directus.