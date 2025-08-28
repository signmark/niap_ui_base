import { apiRequest } from "./queryClient";

// Helper function to get user headers
function getUserHeaders() {
  const user = localStorage.getItem("user");
  if (user) {
    const userData = JSON.parse(user);
    return { "x-user-id": userData.id };
  }
  return {};
}

// Campaigns API
export const campaignsApi = {
  getAll: () => 
    fetch("/api/campaigns", { headers: getUserHeaders() }).then(res => res.json()),
  
  getById: (id: string) => 
    fetch(`/api/campaigns/${id}`, { headers: getUserHeaders() }).then(res => res.json()),
  
  create: (data: any) => 
    apiRequest("POST", "/api/campaigns", data),
  
  update: (id: string, data: any) => 
    apiRequest("PUT", `/api/campaigns/${id}`, data),
  
  delete: (id: string) => 
    apiRequest("DELETE", `/api/campaigns/${id}`),
};

// Content API
export const contentApi = {
  getAll: (campaignId?: string) => {
    const url = campaignId ? `/api/content?campaignId=${campaignId}` : "/api/content";
    return fetch(url, { headers: getUserHeaders() }).then(res => res.json());
  },
  
  getScheduled: () => 
    fetch("/api/content/scheduled", { headers: getUserHeaders() }).then(res => res.json()),
  
  create: (data: any) => 
    apiRequest("POST", "/api/content", data),
  
  update: (id: string, data: any) => 
    apiRequest("PUT", `/api/content/${id}`, data),
  
  delete: (id: string) => 
    apiRequest("DELETE", `/api/content/${id}`),
  
  generate: (data: any) => 
    apiRequest("POST", "/api/content/generate", data),
  
  publish: (contentId: string, platforms: string[]) => 
    apiRequest("POST", `/api/publish/${contentId}`, { platforms }),
};

// Trends API
export const trendsApi = {
  getAll: (campaignId: string) => 
    fetch(`/api/trends?campaignId=${campaignId}`, { headers: getUserHeaders() }).then(res => res.json()),
  
  analyze: (data: any) => 
    apiRequest("POST", "/api/trends/analyze", data),
  
  bookmark: (id: string, isBookmarked: boolean) => 
    apiRequest("PUT", `/api/trends/${id}/bookmark`, { isBookmarked }),
};

// Analytics API
export const analyticsApi = {
  getAll: (campaignId?: string) => {
    const url = campaignId ? `/api/analytics?campaignId=${campaignId}` : "/api/analytics";
    return fetch(url, { headers: getUserHeaders() }).then(res => res.json());
  },
  
  getSummary: () => 
    fetch("/api/analytics/summary", { headers: getUserHeaders() }).then(res => res.json()),
  
  create: (data: any) => 
    apiRequest("POST", "/api/analytics", data),
};

// Questionnaire API
export const questionnaireApi = {
  get: (campaignId: string) => 
    fetch(`/api/questionnaire/${campaignId}`, { headers: getUserHeaders() }).then(res => res.json()),
  
  create: (data: any) => 
    apiRequest("POST", "/api/questionnaire", data),
  
  update: (campaignId: string, data: any) => 
    apiRequest("PUT", `/api/questionnaire/${campaignId}`, data),
};

// Content Sources API
export const contentSourcesApi = {
  getAll: (campaignId?: string) => {
    const url = campaignId ? `/api/content-sources?campaignId=${campaignId}` : "/api/content-sources";
    return fetch(url, { headers: getUserHeaders() }).then(res => res.json());
  },
  
  create: (data: any) => 
    apiRequest("POST", "/api/content-sources", data),
};
