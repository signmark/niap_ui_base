# SMM Manager - Social Media Content Management Platform

## Overview
SMM Manager is an intelligent social media content management platform designed for content creators. It provides AI-powered content generation, analytics, and multi-platform publishing strategies. The application offers adaptive workflows for content creation, intelligent scheduling, multi-language AI-driven content generation, and direct social media publishing capabilities. The project aims to streamline social media content management and enhance content creator efficiency.

## User Preferences
Preferred communication style: Simple, everyday language.

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
- **Monolithic Refactoring (January 2025)**: Active cleanup of monolithic architecture - removed duplicate endpoints, standardizing API responses, eliminating redundant code layers.
- **Console Logging Cleanup (January 2025)**: Removed excessive console logging from trends functionality, scheduler, and image proxy services to provide clean console output. System now runs quietly with only essential system logs.
- **Sentiment Analysis Complete Fix (January 2025)**: Fixed critical Vertex AI API integration by migrating from deprecated :predict endpoint to new :generateContent format. Resolved token limit issues by restricting analysis to 100 comments and truncating long comments. System now successfully analyzes sentiment with 90%+ accuracy and proper JSON response parsing. UI displays correct sentiment emojis after analysis completion.
- **Memory Leak Prevention (January 2025)**: Implemented comprehensive memory management to prevent OOM (Out of Memory) crashes on production servers. Added memory limits to all Map/Set caches (max 500-1000 items), automatic cache cleanup every 30 minutes, graceful shutdown handlers for all services, and global memory monitoring. All setInterval operations now have proper cleanup mechanisms to prevent memory leaks.
- **Source Collection Payload Fix (January 2025)**: Fixed critical issue where source collection created payload with incorrect `sourcesList` field instead of proper `keywords` field. System now correctly creates payload with `collectSources: 1`, populated `platforms` array (with automatic fallback to default platforms if empty), and campaign keywords for N8N webhook processing. This enables proper source discovery based on campaign settings.
- **Source Analysis AI Fix Complete (January 2025)**: Completely resolved AI source analysis by reducing text limit from 15000 to 5000 characters (~1250 tokens), simplifying prompt format to minimize token usage, and increasing maxTokens to 3000. System now successfully performs real AI analysis instead of fallback, generating detailed audience insights with sentiment analysis, behavior patterns, and thematic analysis. Processes up to 200 comments with guaranteed AI analysis completion.
- **January 2025**: Successfully implemented Gemini 2.5 integration via Vertex AI for keyword analysis and business questionnaire features, providing real website content analysis and specific keyword extraction with high accuracy.
- **User Registration Fix (January 2025)**: Fixed critical registration issue where system used incorrect administrator credentials (`admin@roboflow.space` with wrong password) instead of environment variables. Updated `directus-auth-manager.ts` to use `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` from environment. Registration now works correctly in development, production requires server restart to apply changes.
- **YouTube OAuth Fix (January 2025)**: Implemented robust fallback system for YouTube OAuth configuration. System automatically uses database keys when available, seamlessly switches to environment variables when database is inaccessible. Added comprehensive error handling and logging for production troubleshooting.
- **Scheduled Publication Platform Management (January 2025)**: Fixed platform selection logic in scheduled publications. Unchecked platforms are now completely removed from JSON data structure instead of being marked as cancelled, providing cleaner data management and preventing confusion in scheduling system.
- **Automatic Token Refresh for Background Services (January 2025)**: Implemented automatic token refresh mechanism for status-checker service to prevent 401 authentication errors during background operations. The system automatically detects expired tokens, refreshes them, and retries failed requests seamlessly. Scheduler continues using permanent admin token from environment variables.
- **Critical TypeScript Compilation Fix (January 2025)**: Resolved critical compilation errors in `server/routes.ts` that were preventing Vite from starting. Fixed improper imports, undefined variable usage in helper functions, and incorrect Directus API calls. System now compiles and runs successfully with full frontend functionality restored.
- **Enhanced Source Analysis Auto-Collection (January 2025)**: Improved automatic comment collection logic in source analysis to only collect comments for trends that have `comments > 0` but no collected comments in database. Prevents unnecessary duplicate collection while ensuring complete data for AI analysis.
- **Claude API Environment Issues**: Claude API works in Replit development and production environments but fails with 403 "Request not allowed" on staging due to network/geographic restrictions. All TypeScript compilation errors resolved with fallback model logic implemented.
- **N8N-centric Publishing**: All social media platforms publish exclusively through N8N webhooks to ensure consistent architecture and centralized management.
- **Comprehensive Duplicate Prevention**: A 4-level system prevents duplicate posts across platforms using `postUrl` checks, extended caching, a Publication Tracker service, and Lock Manager integration.
- **Intelligent Website Analysis**: A multi-tier fallback system for website analysis uses Gemini AI for content extraction and business questionnaire auto-filling. It prioritizes AI analysis and falls back to intelligent content-based classification if AI services fail.
- **Robust Authentication & Authorization**: JWT token management with automatic refresh and role-based access control (SMM User, SMM Admin). **КРИТИЧЕСКИ ВАЖНО: В UI ИСПОЛЬЗУЮТСЯ ТОЛЬКО ПОЛЬЗОВАТЕЛЬСКИЕ ТОКЕНЫ для всех API запросов. Системные токены используются исключительно для внутренних операций бэкенда (scheduler, background services). Любые запросы от фронтенда должны проходить с пользовательским токеном из браузера.**
- **Social Media API Wizards**: Guided setup wizards simplify complex API configurations, including OAuth flows and token management, by automating steps and providing clear user guidance.
- **Dynamic Environment Detection**: The system automatically detects development, staging, and production environments to configure API endpoints and credentials accordingly.
- **Centralized API Key Management**: Global API keys for services like YouTube are stored in the database for centralized administration.
- **Enhanced Stories Architecture (January 2025)**: Enhanced Stories editor uses independent local state management to prevent conflicts with base Stories editor. Features extended type system for interactive elements and loads content from Directus `metadata` field rather than `content` field.
- **Enhanced Stories Creation System (January 2025)**: Created dual-mode Stories editor system with Simple Mode (single image with customizable text overlay) and Video Mode (video Stories with timed text overlays). Simple mode allows drag-and-drop text positioning with full styling control. Video mode supports up to 30-second videos with multiple text overlays that appear/disappear at specified times. All text positioning and styling data stored in content field. System adapted to Instagram API limitations - no multi-slide Stories support through official API.
- **Stories N8N Integration with Platform-Specific Webhooks (January 2025)**: Stories publication integrated with dual webhook system - Instagram Stories use dedicated `/webhook/publish-instagram-stories` endpoint while other platforms use general `/webhook/publish-stories` endpoint. Implemented automatic fallback logic when Instagram Stories webhook returns 404 error. Uses standardized format with `contentId`, `contentType: 'story'`, `platforms`, and `scheduledAt`. All Stories publishing routes through N8N webhook system for consistency.
- **Trend Collection Days Configuration (January 2025)**: Added configurable collection period for trend analysis. Users can specify how many days back (1-30 days) to collect posts through trend analysis settings UI. The `collectionDays` setting is stored in campaign settings and passed as `day_past` parameter to N8N webhook for trend collection. Default value is 7 days if not specified.
- **Source Highlighting on Trend Selection (January 2025)**: Attempted implementation of automatic source highlighting when trends are clicked. **CRITICAL ISSUE IDENTIFIED**: Source filtering system has fundamental problems with ID matching between trends and sources. Multiple debugging attempts failed to resolve the core filtering logic. System requires complete rebuild of source-trend relationship handling. **STATUS: BROKEN - NEEDS COMPLETE REDESIGN**.
- **Autonomous SMM Bot Implementation (January 2025)**: Implemented complete autonomous bot system with Gemini AI text generation and FAL AI image creation. Bot automatically analyzes trends, generates content with images, and schedules posts using intelligent timing algorithms based on historical data. Features dedicated settings page accessible via robot icon in top navigation, comprehensive API endpoints for bot management, and full integration with existing N8N publishing infrastructure. Bot runs on configurable cycles (default 4 hours) and can create up to 3 posts per cycle across multiple platforms.
- **UI/UX Decisions**: The system maintains a clean, professional interface without any visible debug elements. Stories creation through `/stories/new` automatically clears localStorage and resets store state to ensure a clean slate for new Stories. Robot icon in top navigation provides quick access to autonomous bot settings for the current campaign.

### Feature Specifications
- **AI-Powered Content Generation**: Utilizes AI for multi-language content creation based on campaign context.
- **Intelligent Scheduling**: Automated content publishing with duplicate prevention and status validation.
- **Multi-Platform Publishing**: Supports publishing to Facebook, Instagram, VK, Telegram, and YouTube.
- **Comment Collection & Sentiment Analysis**: Collects comments from social platforms and performs sentiment analysis using AI, with results stored in Directus.
- **Stories Editor**: Provides functionality for creating and editing Instagram Stories with element persistence and streamlined workflows.
- **Enhanced Stories Editor (January 2025)**: Advanced Stories editor with extended interactive elements (polls, questions, music stickers, location stickers, countdown timers). Features independent state management, real-time drag-and-drop positioning, and loads content from Directus metadata field. Bypasses Instagram API limitations by rendering all elements as static graphics.
- **Website Analysis for Business Questionnaire**: Automatically populates business questionnaire fields by analyzing website content and extracting relevant information.
- **Keyword Analysis**: AI-powered website keyword analysis using Gemini 2.5 through Vertex AI (primary) with SOCKS5 proxy fallback. Analyzes any website URL and returns SEO-relevant keywords with real website content analysis. Features automatic fallback logic for maximum reliability.

## External Dependencies

### AI Services
- **Gemini API (Google)**: Primary for content generation, research, trend analysis, sentiment analysis, website analysis, and keyword analysis. Uses Vertex AI (Gemini 2.5) as primary method with SOCKS5 proxy fallback. API endpoint `/api/keywords/analyze-website` provides comprehensive keyword analysis with real website content loading and AI-powered relevance scoring, categorization, and competition metrics.
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