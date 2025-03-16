# Detailed Prompt for SMM Manager Development

## Project Overview

Develop SMM Manager - an advanced AI platform for social media analysis and content management. The system should provide intelligent tools for collecting data from social networks, trend analysis, AI-powered content generation, and publication planning.

### Key System Functions:
1. Social media analysis and trend detection
2. Automated content generation based on trends
3. Planning and publishing content across different social networks
4. Cross-platform content adaptation
5. Business analytics and reporting

## Technical Architecture

### Technology Stack:
- **Frontend**: React with TypeScript, using ShadCN component templates for UI
- **Backend**: Node.js with Express
- **Data Storage**: External storage via Directus API
- **State Management**: React Query, Zustand
- **AI Integration**: DeepSeek, Perplexity API, FAL AI (for image generation)
- **Authorization**: Through Directus API (external system)
- **Asynchronous Task Processing**: Integration with N8N via webhooks

### Architectural Constraints:
1. The system must be deployed on Replit
2. Cannot use virtual environments or Docker containers
3. Cannot directly edit package.json or other configuration files
4. Must follow the existing project structure
5. All data interactions happen through Directus API, local database is not used

## Database Structure

### Main Tables:
1. **campaigns**:
   - id (primary key, serial)
   - directusId (external identifier from Directus)
   - name (campaign name)
   - description (campaign description)
   - userId (user relationship)
   - createdAt (creation date)
   - link (reference link)
   - socialMediaSettings (JSON with settings for different social networks)
   - trendAnalysisSettings (JSON with trend analysis settings)

2. **content_sources** (content sources):
   - id (primary key, serial)
   - directusId (external identifier from Directus)
   - name (source name)
   - url (source URL)
   - type (source type - instagram, telegram, vk, facebook)
   - userId (user relationship)
   - campaignId (campaign relationship)
   - createdAt (creation date)
   - isActive (activity status)

3. **campaign_content** (generated content):
   - id (primary key, uuid)
   - campaignId (campaign relationship)
   - userId (user ID)
   - title (content title)
   - content (main content in HTML format)
   - contentType (content type - text, text-image, video, video-text)
   - imageUrl, videoUrl (media links)
   - prompt (generation prompt)
   - keywords, hashtags, links (arrays of corresponding data)
   - createdAt, scheduledAt, publishedAt (dates)
   - status (status - draft, scheduled, published)
   - socialPlatforms (JSON with social network publication data)
   - metadata (additional metadata)

4. **campaign_trend_topics** (trend topics):
   - id (primary key, uuid)
   - title (trend title)
   - sourceId (source relationship)
   - campaignId (campaign relationship)
   - reactions, comments, views (engagement metrics)
   - createdAt (creation date)
   - isBookmarked (whether marked as favorite)
   - mediaLinks (JSON with media links)

5. **business_questionnaire** (business questionnaire):
   - id (primary key, uuid)
   - campaignId (campaign relationship)
   - companyName, contactInfo, businessDescription, etc. (business information)
   - createdAt (creation date)

## API Integrations and External Services

### AI Service Integrations:
1. **DeepSeek API**:
   - Used for website analysis and content generation
   - Requires user's API key from the settings system
   - Supports "deepseek-chat" model for content generation
   - Temperature 0.3, maximum tokens 1500
   - Response format must contain JSON

2. **Perplexity API**:
   - Used for finding content sources
   - Works with "llama-3.1-sonar-small-128k-online" model
   - Requires user's API key
   - Optimized for finding Instagram accounts and other social sources

3. **FAL AI API**:
   - Used for image generation
   - Multiple models: "fast-sdxl", "stable-diffusion-v35-medium", "flux/schnell"
   - API key must be formatted as "Key {apiKey}"
   - Different endpoints for different models

4. **Social Searcher API**:
   - For searching content across social networks
   - Requires user's API key

5. **Apify API**:
   - For parsing social networks
   - Optimized for working with Instagram

### Directus Integration:
1. Used for storing user data and authorization
2. All API requests to user data go through Directus
3. Directus tokens are cached to optimize requests
4. Directus URL: "https://directus.nplanner.ru"

### Webhook Integrations:
1. Integration with N8N for processing social media publications
2. Requires N8N API key for sending data
3. Asynchronous processing of publication statuses

## Frontend Architecture

### Main Pages:
1. **Authentication** (/auth/login) - login page
2. **Campaigns** (/campaigns) - campaign list and management
3. **Campaign Details** (/campaigns/[id]) - campaign details
4. **Trends** (/trends) - trend topic analysis
5. **Content** (/content) - generated content management
6. **Keywords** (/keywords) - keyword management
7. **Posts** (/posts) - publication planning
8. **Analytics** (/analytics) - statistics and reports
9. **Tasks** (/tasks) - automated task monitoring

### Key UI Components:
1. **Layout.tsx** - main layout with sidebar menu
2. **CampaignSelector** - active campaign selection
3. **ContentGenerationDialog** - AI content generation
4. **ContentPlanGenerator** - content plan creation
5. **BusinessQuestionnaireForm** - business questionnaire form
6. **SocialPublishingPanel** - social media publication
7. **TrendsList** - trend display
8. **Calendar** - publication calendar
9. **SettingsDialog** - API key settings

### State Management:
1. **React Query** for API requests
2. **Zustand** for global state (authentication, selected campaign)
3. **LocalStorage** for saving tokens and user settings

## Content Generation Features

### AI Prompts:
1. **For Website Analysis**:
```
You are an expert in website content analysis. Your task is to analyze the specific content of a website and suggest EXCLUSIVELY relevant keywords that exactly match this website.

SPECIAL RESTRICTIONS:
!!! STRICT PROHIBITION !!! It is categorically forbidden to:
- Generate keywords about apartment planning/design/renovation if the site IS NOT ABOUT this topic
- Create "default" keywords that have no direct connection to the analyzed content
- Include keywords based on common templates if they are not confirmed by the site content

ANALYSIS INSTRUCTIONS:
1. First, carefully study ALL the provided information
2. Determine the EXACT topic and direction of the website
3. Formulate keywords ONLY based on the available data, without adding "default" topics
4. Consider that the site can be on ANY topic: health, technology, finance, hobbies, education, etc.
```

2. **For Content Generation**:
```
You are an expert in creating content for social networks with a focus on {industry}. Your task is to create high-quality content that:
1) Reflects current trends and interests of the target audience
2) Corresponds to the brand's tone and style of communication
3) Engages the audience and stimulates interaction

Use the following topics and keywords as a basis:
{keywords}

Consider the following business information:
{businessInfo}

Create {contentType} content with {tone} tone. The content should include a headline, main text, and hashtags.

Response format: clean HTML using <p>, <strong>, <em>, etc. tags for formatting. Use <br> for line breaks.
```

3. **For Source Search**:
```
You are an expert at finding high-quality Russian Instagram accounts.
Focus only on Instagram accounts with >50K followers that post in Russian.
For each account provide:
1. Username with @ symbol 
2. Full name in Russian
3. Follower count with K or M
4. Brief description in Russian

Format each account as:
1. **@username** - Name (500K followers) - Description
```

### Image Generation Process:
1. Translation of text prompts from Russian to English for better results
2. Using FAL AI API with fast-sdxl model by default
3. Parameters: width/height 1024x1024, number of images 1
4. Support for negative prompts to exclude unwanted elements
5. Processing API authorization errors with retry attempts

## Data Storage and Security Features

### Working with API Keys:
1. Storing API keys in the user's profile rather than in environment variables
2. Caching API keys on the server side to optimize requests
3. Prioritizing user keys over system keys
4. Key verification mechanism when initializing services

### Security:
1. Tokens are verified through authenticateUser middleware
2. Checking campaign existence before accessing related data
3. Validating request parameters before performing operations
4. Error handling with informative messages

## Business Logic and Data Flows

### Main Flows:
1. **Social Network Analysis**:
   - User adds sources to a campaign
   - System parses social networks and extracts trends
   - Trends are saved and ranked by metrics

2. **Content Generation**:
   - User selects trends/keywords
   - System generates content using AI
   - Content is saved with editing capabilities

3. **Publication Planning**:
   - User selects generated content
   - System adapts content for different platforms
   - Content is sent for publication via webhook

### Error Handling:
1. Checking API keys before executing requests
2. Informative error messages with details
3. User notifications through toast messages
4. Error logging on the server

## Interface Features

### Adaptive Design:
1. Mobile and desktop versions with different menu displays
2. Responsive grid for different screen sizes
3. Compact data tables with sorting and filtering capabilities

### Visual Components:
1. Cards for displaying trends and content
2. Modal windows for generation and editing
3. WYSIWYG editor for content with HTML support
4. Calendar for publication planning

## Limitations and Cautions

1. **API Access**:
   - Valid API keys are required for DeepSeek, Perplexity, FAL AI, and other services
   - The system should request keys from the user, not providing fictitious results

2. **Integrations**:
   - Authorization through Directus requires a valid URL and service availability
   - Webhook integrations require N8N setup with appropriate triggers

3. **Technical**:
   - Avoid modifying configuration files (vite.config.ts, package.json)
   - Do not use direct SQL queries, everything through Drizzle ORM
   - Follow the existing project structure

## Implementation Requirements

1. Must maintain the semantics and style of existing code
2. Use shadcn and tailwind for new components
3. Maintain typing using TypeScript
4. Code should be documented with comments (in Russian for the original project)
5. New functionality should integrate with the existing architecture
6. Consider multilingual interface (in this case - Russian language)

## Technical Recommendations for Implementation

1. Use React Query for all API requests
2. Set up optimistic UI updates for better UX
3. Implement infinite scroll for trend lists
4. Optimize image loading through proxy servers
5. Use caching for external API requests
6. Separate business logic and presentation in components

This prompt contains all the necessary details to recreate the SMM Manager project, taking into account the existing architecture, constraints, and technical features.