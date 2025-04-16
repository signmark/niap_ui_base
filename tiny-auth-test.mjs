import axios from 'axios';
import crypto from 'crypto';

const ACCESS_KEY = process.env.BEGET_S3_ACCESS_KEY;
const SECRET_KEY = process.env.BEGET_S3_SECRET_KEY;
const BUCKET = process.env.BEGET_S3_BUCKET;

async function testAuth() {
  const url = `https://s3.ru1.storage.beget.cloud/${BUCKET}`;
  const date = new Date().toUTCString();
  const stringToSign = `HEAD\n\n\n${date}\n/${BUCKET}`;
  
  const hmac = crypto.createHmac('sha1', SECRET_KEY);
  const signature = hmac.update(Buffer.from(stringToSign, 'utf-8')).digest('base64');
  
  const headers = {
    'Date': date,
    'Authorization': `AWS ${ACCESS_KEY}:${signature}`
  };
  
  console.log('URL:', url);
  console.log('Access Key:', ACCESS_KEY);
  
  try {
    const response = await axios.head(url, { headers });
    console.log('Success! Status:', response.status);
    return true;
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) console.error('Status:', error.response.status);
    return false;
  }
}

testAuth();
