# SMM Manager - Social Media Content Management Platform

## Overview
SMM Manager is an intelligent social media content management platform designed to empower content creators with AI-powered content generation, analytics, and multi-platform publishing capabilities. It provides adaptive workflows, intelligent scheduling, multi-language AI-driven content creation, and direct publishing to social media. The project aims to provide a comprehensive solution for efficient content management and distribution, with a vision for significant market potential in the creator economy.

## User Preferences
Preferred communication style: Simple, everyday language.
Every user request must be properly self-prompted to ensure complete understanding and systematic execution.
ВСЕГДА ИЩИТЕ ПРОБЛЕМЫ В КОДЕ ПЕРВУЮ ОЧЕРЕДЬ, а не в сервисах/API. API работают - ищите баги в логике, кэше, выполнении кода. Промптируйте себя правильно для поиска багов в коде.
Do not make changes to the folder `node_modules`.

## System Architecture

### Technology Stack
- **Frontend**: React with TypeScript
- **Backend**: Node.js/Express
- **Content Management & Database**: Directus headless CMS
- **State Management**: React Query
- **Authentication**: Custom token refresh middleware
- **AI Integration**: Gemini (primary), FAL AI Proxy
- **Automation**: N8N workflow automation
- **Deployment**: Docker with Traefik reverse proxy

### Core Architectural Decisions
- **Monolith to Microservices (Planned)**: Current architecture is monolithic; future refactoring prioritizes breaking down the large `routes.ts` file and improving modularity.
- **Environment Detection**: Automatic detection for development (Replit), staging, and production environments, dynamically configuring Directus URLs and credentials.
- **Component-Based Frontend**: Reusable UI elements in a React-based SPA.
- **Modular Backend**: Express.js with a structured route system, JWT token management, and scheduled publishing.
- **Directus as Primary Data Store**: All core data (campaigns, content, API keys, questionnaires) managed via Directus.
- **N8N-Centric Publishing**: All social media publishing is exclusively handled via N8N webhooks, eliminating direct API calls from the main application for consistency and reliability.
- **Robust Publishing System**: Features include a scheduler service, platform-specific handlers, 4-level duplicate prevention, and automatic status correction.
- **AI-Driven Content Workflow**: AI generates content based on user input, and content is scheduled and published automatically.
- **Comprehensive Authentication**: JWT-based with refresh mechanisms, role-based access control, and strict token usage rules (user tokens for UI, system tokens for background tasks).
- **Advanced Website Analysis**: Extracts content from websites for AI-driven business questionnaire auto-filling, using a multi-tier fallback system (Gemini API, intelligent content analysis, domain-based contextualization).
- **Sentiment Analysis**: Integration with Gemini AI for analyzing social media comments, with results stored in Directus.
- **Instagram & YouTube Integration**: Automated setup wizards for streamlined API configuration and credential management, including OAuth flows and token persistence.

## External Dependencies

### AI Services
- **Gemini API**: Primary for content generation, research, trend analysis, and website analysis.
- **FAL AI**: For image and video generation.

### Social Media APIs (Integrated via N8N)
- **Facebook Graph API**
- **Instagram Basic Display API**
- **VK API**
- **Telegram Bot API**
- **YouTube Data API**

### Infrastructure Services
- **Directus**: Headless CMS for all data management.
- **N8N**: Workflow automation engine for publishing and other complex flows.
- **Beget S3**: File storage for media assets.
- **PostgreSQL**: Database used by Directus and N8N.
- **Traefik**: Reverse proxy for Docker deployments.