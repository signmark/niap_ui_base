# Architecture Overview

## Overview

SMM Manager is an intelligent social media management platform that helps content creators with AI-assisted content generation, analytics, and multi-platform publishing strategies. The platform provides adaptive workflows for content creation with intelligent scheduling, multi-language content generation using AI, and direct publishing capabilities to various social media platforms.

## System Architecture

The system follows a modern client-server architecture with a clear separation between frontend and backend components:

### Frontend Architecture

- **Technology Stack**: React with TypeScript, using a component-based architecture
- **State Management**: React Query for server state management
- **UI Framework**: Shadcn UI (based on Tailwind CSS and Radix UI)
- **Routing**: Implicit from the project structure, likely using React Router
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture

- **Technology Stack**: Node.js with Express.js
- **API Design**: RESTful API design pattern for client-server communication
- **Authentication**: Custom middleware for JWT token management and refresh
- **File Upload**: Multer for handling multipart/form-data

### Data Storage

- **Primary Database**: PostgreSQL with Drizzle ORM for database interactions
- **Schema Management**: Drizzle for type-safe schema definitions and migrations
- **Cloud Storage**: Beget S3 (S3-compatible storage) for media files, particularly videos

### External Integrations

- **CMS**: Directus as a headless CMS for content management
- **Workflow Automation**: n8n for workflow automation and content planning
- **Social Media**: Direct integrations with Facebook/Instagram, Telegram, and VK

## Key Components

### Client Components

1. **Authentication System**
   - JWT-based authentication with automatic token refresh
   - Role-based access control (Admin/User permissions)

2. **Content Editor**
   - Rich text editing capabilities with HTML formatting
   - Media upload and management for images and videos
   - Emoji picker integration

3. **Content Scheduler**
   - Calendar interface for scheduling posts
   - Time zone management for consistent scheduling across regions

4. **AI Content Generation**
   - Integration with multiple AI providers (DeepSeek, Perplexity, Google's Generative AI, Claude)
   - Content enhancement and optimization tools

### Server Components

1. **API Layer**
   - RESTful endpoints for client-server communication
   - Security middleware for authentication and authorization
   - Rate limiting and error handling

2. **Social Media Publishing Services**
   - Platform-specific publishing adapters (Telegram, Instagram, Facebook, VK)
   - Media transformation and format optimization
   - Post status tracking and URL storage

3. **Media Processing Service**
   - Video processing with ffmpeg
   - Image optimization for various platforms
   - S3 storage integration for media assets

4. **Authentication Service**
   - Token generation and validation
   - User session management
   - Integration with Directus authentication

## Data Flow

1. **Content Creation Flow**
   - User creates content in the UI editor
   - Content is optionally enhanced with AI assistance
   - Media files are uploaded to Beget S3 storage
   - Content metadata and references are stored in PostgreSQL

2. **Publishing Flow**
   - Scheduled content is retrieved based on publication time
   - Platform-specific formatting is applied (HTML sanitization, media optimization)
   - Content is published to selected social platforms via their APIs
   - Publication results and URLs are stored back in the database

3. **Authentication Flow**
   - User logs in via Directus authentication
   - JWT tokens are issued and managed by the custom auth middleware
   - Token refreshing is handled automatically before expiration

## External Dependencies

### Social Media Platforms
- **Facebook/Instagram**: Graph API for post publishing and management
- **Telegram**: Bot API for channel and group posting
- **VK**: VK API for community posting

### AI Services
- **Google Generative AI**: For content generation and enhancement
- **Claude AI (Anthropic)**: Advanced AI assistant for content creation
- **FAL AI**: Image generation and manipulation
- **DeepSeek/Perplexity**: Additional AI providers for content optimization

### Infrastructure Services
- **Beget S3**: S3-compatible cloud storage for media files
- **Directus**: Headless CMS for content management
- **n8n**: Workflow automation platform integrated for content planning

## Deployment Strategy

The application is designed for flexible deployment with multiple options:

1. **Docker Deployment**
   - Docker Compose configuration for all service dependencies
   - Container orchestration for scaling individual components
   - Environment-specific configuration through .env files

2. **Replit Deployment**
   - Configuration for direct deployment on Replit platform
   - Utilizing Replit's persistent storage and environment

3. **Development Environment**
   - Local Node.js server with hot reloading
   - PostgreSQL local instance
   - Environment variable management for different contexts

### Environment Configuration
- Comprehensive environment variable management for different deployment scenarios
- Sensitive information (API keys, tokens) managed through environment variables
- Different configurations for development, testing, and production environments

## Security Considerations

- JWT token-based authentication with proper expiration and refresh mechanism
- Secure storage of API keys and authentication tokens
- HTML sanitization for user-generated content
- HTTPS enforcement for all API communications
- Proper error handling to prevent information leakage