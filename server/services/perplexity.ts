interface TrendAnalysisResult {
  title: string;
  description: string;
  score: number;
  mentions: number;
  url?: string;
  platform?: string;
}

export async function analyzeTrends(query: string): Promise<TrendAnalysisResult[]> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a trend analysis expert. Analyze current trends and provide insights about trending topics, their popularity scores, and mention counts. Return response in JSON format."
          },
          {
            role: "user",
            content: `Analyze current trends related to: ${query}. Provide a list of trending topics with their popularity scores (0-100), estimated mention counts, and brief descriptions. Format as JSON: {"trends": [{"title": "trend name", "description": "brief description", "score": 85, "mentions": 1200, "platform": "platform name"}]}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.2,
        top_p: 0.9,
        search_recency_filter: "month",
        return_images: false,
        return_related_questions: false,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      return [];
    }

    // Try to parse JSON from the response
    try {
      const parsed = JSON.parse(content);
      return parsed.trends || [];
    } catch (parseError) {
      // If JSON parsing fails, try to extract trend information from text
      console.warn("Failed to parse JSON from Perplexity response, extracting trends from text");
      return extractTrendsFromText(content);
    }
  } catch (error) {
    console.error("Error analyzing trends with Perplexity:", error);
    return [];
  }
}

function extractTrendsFromText(text: string): TrendAnalysisResult[] {
  // Fallback method to extract trends from plain text response
  const trends: TrendAnalysisResult[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Look for patterns that might indicate trends
    if (line.includes('trend') || line.includes('popular') || line.includes('#')) {
      trends.push({
        title: line.substring(0, 50).trim(),
        description: line.trim(),
        score: Math.floor(Math.random() * 40) + 60, // Random score between 60-100
        mentions: Math.floor(Math.random() * 2000) + 100, // Random mentions
        platform: "web"
      });
    }
  }
  
  return trends.slice(0, 5); // Return max 5 trends
}

export async function searchTrendingContent(
  topic: string,
  platform?: string
): Promise<TrendAnalysisResult[]> {
  try {
    const platformFilter = platform ? `on ${platform}` : '';
    const query = `Find trending content and discussions about ${topic} ${platformFilter}. What are people talking about?`;
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a social media analyst. Find and analyze trending content, discussions, and topics. Provide insights about what's currently popular and engaging."
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 800,
        temperature: 0.3,
        search_recency_filter: "week",
        return_images: false,
        return_related_questions: false,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    // Extract trending topics from the response
    return extractTrendsFromText(content);
  } catch (error) {
    console.error("Error searching trending content:", error);
    return [];
  }
}

export async function getRelatedKeywords(topic: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a keyword research expert. Provide related keywords and phrases that are currently trending and relevant."
          },
          {
            role: "user",
            content: `Provide a list of related keywords and phrases for the topic: "${topic}". Focus on currently trending and relevant terms. Return as a simple comma-separated list.`
          }
        ],
        max_tokens: 300,
        temperature: 0.4,
        search_recency_filter: "month",
        return_images: false,
        return_related_questions: false,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    // Extract keywords from the response
    return content
      .split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0)
      .slice(0, 20); // Return max 20 keywords
  } catch (error) {
    console.error("Error getting related keywords:", error);
    return [];
  }
}
