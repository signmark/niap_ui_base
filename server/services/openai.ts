import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "default_key" 
});

interface ContentGenerationOptions {
  contentType?: 'post' | 'article' | 'caption' | 'story';
  language?: 'ru' | 'en' | 'es' | 'fr' | 'de';
  tone?: 'professional' | 'casual' | 'friendly' | 'formal' | 'creative';
  platform?: 'instagram' | 'vk' | 'telegram' | 'facebook' | 'twitter';
}

interface GeneratedContent {
  title: string;
  content: string;
  keywords: string[];
  hashtags?: string[];
  callToAction?: string;
}

export async function generateContent(
  prompt: string, 
  options: ContentGenerationOptions = {}
): Promise<GeneratedContent | null> {
  try {
    const { contentType = 'post', language = 'ru', tone = 'professional', platform } = options;
    
    const systemPrompt = `You are an expert SMM content creator. Generate high-quality social media content in ${language} language. 
    Content type: ${contentType}
    Tone: ${tone}
    ${platform ? `Platform: ${platform}` : ''}
    
    Return response in JSON format with the following structure:
    {
      "title": "Engaging title for the content",
      "content": "Main content text",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"],
      "callToAction": "Call to action text"
    }
    
    Make sure the content is engaging, relevant, and optimized for social media engagement.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const generatedText = response.choices[0].message.content;
    if (!generatedText) {
      throw new Error("No content generated");
    }

    const parsedContent = JSON.parse(generatedText);
    return {
      title: parsedContent.title || "Generated Content",
      content: parsedContent.content || "",
      keywords: parsedContent.keywords || [],
      hashtags: parsedContent.hashtags || [],
      callToAction: parsedContent.callToAction || "",
    };
  } catch (error) {
    console.error("Error generating content with OpenAI:", error);
    return null;
  }
}

export async function generateHashtags(content: string, platform?: string): Promise<string[]> {
  try {
    const systemPrompt = `Generate relevant hashtags for the following social media content. 
    ${platform ? `Platform: ${platform}` : ''}
    
    Return response in JSON format:
    {
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
    }
    
    Focus on trending and relevant hashtags that will increase engagement.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.hashtags || [];
  } catch (error) {
    console.error("Error generating hashtags:", error);
    return [];
  }
}

export async function optimizeContentForPlatform(
  content: string, 
  platform: string
): Promise<string> {
  try {
    const systemPrompt = `Optimize the following social media content for ${platform}. 
    Consider platform-specific best practices, character limits, and audience preferences.
    
    Return the optimized content as plain text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: content }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0].message.content || content;
  } catch (error) {
    console.error("Error optimizing content for platform:", error);
    return content;
  }
}

export async function generateContentIdeas(
  businessDescription: string,
  targetAudience: string,
  goals: string[]
): Promise<string[]> {
  try {
    const systemPrompt = `Generate creative content ideas for a business based on the following information:
    Business: ${businessDescription}
    Target Audience: ${targetAudience}
    Goals: ${goals.join(', ')}
    
    Return response in JSON format:
    {
      "ideas": ["idea1", "idea2", "idea3", "idea4", "idea5"]
    }
    
    Each idea should be specific, actionable, and aligned with the business goals.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.ideas || [];
  } catch (error) {
    console.error("Error generating content ideas:", error);
    return [];
  }
}
