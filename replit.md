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

## User Preferences

Preferred communication style: Simple, everyday language.

### Technical Notes
- **Stories API Authentication**: Always use user token (req.headers.authorization) for Directus API calls, never use admin token. User tokens work constantly in the system and have proper permissions for campaign_content collection.
- **Database Storage**: All Stories data should be stored in campaign_content.metadata field as JSON, not in separate fields.
- **Database**: System does not use PostgreSQL - uses Directus as primary database/CMS with external hosted instance.