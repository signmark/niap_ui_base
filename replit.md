# SMM Manager - Social Media Content Management Platform

## Overview
SMM Manager is an intelligent social media content management platform designed for content creators. It provides AI-powered content generation, analytics, and multi-platform publishing strategies. The application offers adaptive workflows for content creation, intelligent scheduling, multi-language AI-driven content generation, and direct social media publishing capabilities. The project aims to streamline social media content management and enhance content creator efficiency, offering significant market potential for content creators seeking efficiency and broader reach.

## User Preferences
Preferred communication style: Simple, everyday language.
Work approach: Thoughtful and deliberate implementation with minimal errors, prioritizing quality over speed.

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
- **Monolithic Refactoring**: Ongoing effort to clean up and standardize API responses, remove redundant code, and improve overall system efficiency.
- **Console Logging Cleanup**: Minimized console output to essential system logs for a quieter and cleaner operational environment.
- **Sentiment Analysis**: Robust integration with Vertex AI for accurate sentiment analysis of social media comments, including token limit management and proper JSON response parsing.
- **Memory Management**: Comprehensive measures implemented to prevent Out of Memory (OOM) errors, including memory limits for caches, automatic cache cleanup, graceful shutdown handlers, and proper cleanup for `setInterval` operations.
- **Source Collection & Analysis**: Corrected payload structures for source collection and enhanced AI analysis for generating detailed audience insights (sentiment, behavior patterns, thematic analysis) from social media comments.
- **AI Integration**: Successfully integrated Gemini 2.5 via Vertex AI for keyword analysis, website content analysis, and business questionnaire features.
- **Authentication & Authorization**: Robust JWT token management with automatic refresh and role-based access control (SMM User, SMM Admin). Crucially, UI uses user tokens for all API requests; system tokens are exclusively for backend operations.
- **Social Media API Wizards**: Guided setup wizards automate complex API configurations, including OAuth flows.
- **Dynamic Environment Detection**: Automatic configuration of API endpoints and credentials based on development, staging, or production environments.
- **Centralized API Key Management**: Global API keys stored in the database for central administration.
- **Stories Editor**: Dual-mode editor (Simple and Video) with independent local state management, extended type system for interactive elements, and content loading from Directus `metadata` field. Supports drag-and-drop text positioning and timed text overlays for videos. Publication is integrated with platform-specific N8N webhooks. **Recent fixes (Aug 2025)**: Resolved metadata JSON parsing errors, improved UI layout with larger preview (350x620px) positioned on the right, fixed JSX structural issues, and ensured proper data persistence in browser state until explicit save.
- **Instagram Stories Video Conversion**: **BREAKTHROUGH**: Instagram Graph API accepts H.264 Main profile videos successfully. After extensive testing with Baseline, High, and Constrained Baseline profiles (all rejected with ERROR status), discovered that H.264 Main profile with Level 4.0, 1080x1920 resolution, 30 FPS, yuv420p format works perfectly. Key requirements: proper S3 hosting with Accept-Ranges: bytes headers, video/mp4 content-type, and H.264 Main profile encoding. Complete workflow: Main profile conversion → S3 upload → Directus URL update → N8N publication through Instagram Graph API.
- **Trend Collection Configuration**: Users can configure the number of days for trend analysis data collection (1-30 days).
- **Duplicate Prevention**: A 4-level system ensures no duplicate posts across platforms using `postUrl` checks, caching, Publication Tracker, and Lock Manager.
- **Website Analysis**: Multi-tier fallback system for website analysis prioritizes Gemini AI for content extraction and business questionnaire auto-filling, with intelligent content-based classification as a fallback.
- **UI/UX Decisions**: Clean, professional interface with automatic localStorage clearing and state reset for new Stories creation.

### Feature Specifications
- **AI-Powered Content Generation**: Multi-language content creation based on campaign context.
- **Intelligent Scheduling**: Automated content publishing with duplicate prevention and status validation.
- **Multi-Platform Publishing**: Supports Facebook, Instagram, VK, Telegram, and YouTube. All publishing occurs exclusively through N8N webhooks.
- **Comment Collection & Sentiment Analysis**: Collects comments and performs AI-driven sentiment analysis, storing results in Directus.
- **Stories Editor**: Enhanced functionality for creating and editing Instagram Stories, including interactive elements (polls, questions, music stickers, location stickers, countdown timers) rendered as static graphics to bypass Instagram API limitations.
- **Website Analysis for Business Questionnaire**: Automatically populates business questionnaire fields by analyzing website content.
- **Keyword Analysis**: AI-powered website keyword analysis using Gemini 2.5 via Vertex AI (with SOCKS5 proxy fallback) to extract SEO-relevant keywords from any website URL.

## External Dependencies

### AI Services
- **Gemini API (Google)**: Primary for content generation, research, trend analysis, sentiment analysis, website analysis, and keyword analysis, utilizing Vertex AI (Gemini 2.5).
- **FAL AI**: Used for image and video generation.

### Social Media APIs (via N8N)
- **Facebook Graph API**: For direct posting and page management.
- **Instagram Basic Display API**: For content publishing and account management.
- **VK API**: For publishing and comment collection.
- **Telegram Bot API**: For publishing and comment collection.
- **YouTube Data API**: For video uploads, metadata management, and token refresh.

### Infrastructure Services
- **Directus**: Headless CMS serving as the primary database.
- **N8N**: Workflow automation tool for all social media publishing and backend flows.
- **Beget S3**: File storage for media assets.
- **PostgreSQL**: Database used by Directus.