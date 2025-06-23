import axios from 'axios';

export async function uploadVideoToBegetS3(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('video', file);

  const token = localStorage.getItem('auth_token');
  
  const response = await axios.post('/api/beget-s3-video/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });

  if (response.data && response.data.success && (response.data.url || response.data.videoUrl)) {
    const videoUrl = response.data.url || response.data.videoUrl;
    return { url: videoUrl };
  }
  
  throw new Error('Failed to upload video');
}