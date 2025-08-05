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
- **Monolithic to Modular Transition**: Ongoing effort to break down monolithic files into modular components for better maintainability and scalability.
- **N8N-centric Publishing**: All social media platforms publish exclusively through N8N webhooks to ensure consistent architecture and centralized management.
- **Comprehensive Duplicate Prevention**: A 4-level system prevents duplicate posts across platforms using `postUrl` checks, extended caching, a Publication Tracker service, and Lock Manager integration.
- **Intelligent Website Analysis**: A multi-tier fallback system for website analysis uses Gemini AI for content extraction and business questionnaire auto-filling. It prioritizes AI analysis and falls back to intelligent content-based classification if AI services fail.
- **Robust Authentication & Authorization**: JWT token management with automatic refresh and role-based access control (SMM User, SMM Admin). Strict separation of user tokens (for UI) and system tokens (for backend tasks).
- **Social Media API Wizards**: Guided setup wizards simplify complex API configurations, including OAuth flows and token management, by automating steps and providing clear user guidance.
- **Dynamic Environment Detection**: The system automatically detects development, staging, and production environments to configure API endpoints and credentials accordingly.
- **Centralized API Key Management**: Global API keys for services like YouTube are stored in the database for centralized administration.
- **UI/UX Decisions**: The system maintains a clean, professional interface without any visible debug elements. Stories creation through `/stories/new` automatically clears localStorage and resets store state to ensure a clean slate for new Stories.

### Feature Specifications
- **AI-Powered Content Generation**: Utilizes AI for multi-language content creation based on campaign context.
- **Intelligent Scheduling**: Automated content publishing with duplicate prevention and status validation.
- **Multi-Platform Publishing**: Supports publishing to Facebook, Instagram, VK, Telegram, and YouTube.
- **Comment Collection & Sentiment Analysis**: Collects comments from social platforms and performs sentiment analysis using AI, with results stored in Directus.
- **Stories Editor**: Provides functionality for creating and editing Instagram Stories with element persistence and streamlined workflows.
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