import axios from 'axios';

export async function uploadImageToBegetS3(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('auth_token');
  
  const response = await axios.post('/api/imgur/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });

  if (response.data && response.data.success && response.data.url) {
    return { url: response.data.url };
  }
  
  throw new Error('Failed to upload image');
}