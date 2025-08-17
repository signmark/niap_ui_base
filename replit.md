# SMM Manager - Social Media Content Management Platform

## Overview
SMM Manager is an intelligent social media content management platform for content creators. It provides AI-powered content generation, analytics, and multi-platform publishing strategies, aiming to streamline social media content management and enhance creator efficiency. Key capabilities include adaptive workflows, intelligent scheduling, multi-language AI-driven content generation, and direct social media publishing.

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
- **AI Integration**: Implemented Gemini 2.5 via Vertex AI for features like keyword analysis, business questionnaire, content generation, sentiment analysis, and website analysis.
- **Monolithic Refactoring**: Ongoing effort to streamline architecture by removing duplicate endpoints, standardizing API responses, and eliminating redundant code.
- **Memory Management**: Comprehensive measures to prevent out-of-memory errors, including memory limits for caches, automatic cache cleanup, graceful shutdown handlers, and global memory monitoring.
- **Authentication & Authorization**: JWT token management with automatic refresh and role-based access control (SMM User, SMM Admin). UI uses user tokens for all API requests; system tokens are exclusively for internal backend operations.
- **N8N-centric Publishing**: All social media platform publishing is routed exclusively through N8N webhooks for consistent architecture and centralized management.
- **Duplicate Prevention**: A 4-level system prevents duplicate posts across platforms using `postUrl` checks, extended caching, a Publication Tracker service, and Lock Manager integration.
- **Intelligent Website Analysis**: A multi-tier fallback system for website analysis prioritizes AI analysis (Gemini) for content extraction and business questionnaire auto-filling, with intelligent content-based classification as a fallback.
- **Social Media API Wizards**: Guided setup wizards simplify complex API configurations, including OAuth flows and token management.
- **Dynamic Environment Detection**: The system automatically detects development, staging, and production environments to configure API endpoints and credentials.
- **Centralized API Key Management**: Global API keys for services like YouTube are stored in the database.
- **Stories Architecture**: Features a dual-mode Stories editor (Simple and Video) with independent local state management and support for interactive elements. Content loads from Directus `metadata` field. Stories publication uses platform-specific N8N webhooks.
- **Autonomous SMM Bot**: Integrated an autonomous bot system with Gemini AI text generation and FAL AI image creation. The bot analyzes trends, generates content, and schedules posts using intelligent timing algorithms, integrating with the N8N publishing infrastructure. It can also generate content based on business questionnaire data.
- **UI/UX Decisions**: Maintains a clean, professional interface. Stories creation clears local storage and resets store state. A robot icon provides quick access to autonomous bot settings.

### Feature Specifications
- **AI-Powered Content Generation**: Utilizes AI for multi-language content creation based on campaign context and business questionnaire data.
- **Intelligent Scheduling**: Automated content publishing with duplicate prevention and status validation.
- **Multi-Platform Publishing**: Supports publishing to Facebook, Instagram, VK, Telegram, and YouTube.
- **Comment Collection & Sentiment Analysis**: Collects comments from social platforms and performs AI-driven sentiment analysis, storing results in Directus.
- **Stories Editor**: Provides functionality for creating and editing Instagram Stories with element persistence, real-time drag-and-drop positioning, and streamlined workflows.
- **Website Analysis for Business Questionnaire**: Automatically populates business questionnaire fields by analyzing website content and extracting relevant information.
- **Keyword Analysis**: AI-powered website keyword analysis using Gemini 2.5 through Vertex AI, with SOCKS5 proxy fallback.

## External Dependencies

### AI Services
- **Gemini API (Google)**: Primary for content generation, research, trend analysis, sentiment analysis, website analysis, and keyword analysis, typically via Vertex AI (Gemini 2.5).
- **FAL AI**: Used for image and video generation.

### Social Media APIs (via N8N)
- **Facebook Graph API**: For direct posting and page management.
- **Instagram Basic Display API**: For content publishing and account management.
- **VK API**: For publishing and comment collection.
- **Telegram Bot API**: For publishing and comment collection.
- **YouTube Data API**: For video uploads, metadata management, and token refresh.

### Infrastructure Services
- **Directus**: Headless CMS used as the primary database.
- **N8N**: Workflow automation tool for social media publishing, token management, and complex backend flows.
- **Beget S3**: File storage for media assets.
- **PostgreSQL**: Database used by Directus.