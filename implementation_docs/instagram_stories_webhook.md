# Instagram Stories Webhook Implementation

## Overview

This document describes the implementation of Instagram Stories publishing functionality via an n8n webhook in the SMM Manager application.

## Implementation Details

The webhook endpoint is implemented in `server/api/instagram-stories-webhook.ts` and registered in the Express router.

### Endpoint

```
POST /api/instagram-stories-webhook
```

### Request Body

The endpoint accepts a JSON request body with the following parameters:

- `contentId` (required): The ID of the content to be published as an Instagram Story
- `forceStories` (optional): If set to `true`, it will treat the content as a Story regardless of its `content_type` value (useful for testing)

### Workflow

1. **Authentication**: The handler first authenticates with Directus using admin credentials.
2. **Content Retrieval**: It retrieves the content data from Directus using the provided `contentId`.
3. **Content Type Validation**: It verifies that the content has a `content_type` of "stories" or that `forceStories` is set to `true`.
4. **Media Validation**: It checks that the content has at least one image or video (either primary or in additional media arrays).
5. **Webhook Forwarding**: It forwards the content data to the n8n webhook endpoint (https://n8n.nplanner.ru/webhook-test/publish-instagram-stories).
6. **Status Update**: In production, it would update the content's status in Directus, but in the demonstration implementation, this step is skipped to avoid potential errors.

### Example Usage

```bash
curl -X POST 'http://localhost:5000/api/instagram-stories-webhook' \
-H 'Content-Type: application/json' \
-d '{"contentId": "7f2401d8-1806-4c08-b218-f459fc4579b5", "forceStories": true}'
```

### Response

The endpoint returns a JSON response indicating whether the request was successfully processed:

```json
{
  "success": true,
  "message": "Запрос на публикацию Instagram Stories отправлен успешно",
  "result": {
    "platform": "instagram",
    "status": "pending",
    "publishedAt": null,
    "message": "Запрос на публикацию Instagram Stories отправлен"
  }
}
```

## Error Handling

The webhook handler gracefully handles various types of errors:

1. **Missing Content ID**: Returns a 400 error if `contentId` is not provided.
2. **Authentication Errors**: Returns a 500 error if authentication with Directus fails.
3. **Content Not Found**: Returns a 404 error if the content with the given ID is not found in Directus.
4. **Invalid Content Type**: Returns a 400 error if the content type is not "stories" and `forceStories` is not set to `true`.
5. **Missing Media**: Returns a 400 error if no images or videos are available for the story.
6. **n8n Webhook Errors**: In the demonstration implementation, errors from the n8n webhook are logged but not propagated back to the caller, as the production endpoint would be properly set up.

## Configuration

The webhook endpoint URL can be configured using the `INSTAGRAM_STORIES_WEBHOOK_URL` environment variable. If not provided, it defaults to `https://n8n.nplanner.ru/webhook-test/publish-instagram-stories`.

## Related Components

- **Directus API Manager**: Used to authenticate and retrieve content data from Directus.
- **n8n Workflow**: The receiving end of the webhook, responsible for executing the actual Instagram Story publishing logic.