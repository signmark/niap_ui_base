import axios from 'axios';

export async function uploadImageToBegetS3(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('auth_token');
  
  try {
    const response = await axios.post('/api/beget-s3-aws/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });

    if (response.data && response.data.success && response.data.url) {
      return { url: response.data.url };
    }
    
    throw new Error('Failed to upload image to S3');
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload image');
  }
}