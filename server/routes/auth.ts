import express from 'express';
import { authenticateUser } from '../middleware/auth';
import { directusApi } from '../directus';
import { log } from '../utils/logger';

const router = express.Router();

/**
 * Authentication Routes
 * Handles user login, logout, token refresh, and user profile management
 */

// Get current user information
router.get('/me', authenticateUser, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const token = req.user.token;

    log('auth', `Getting user info for user ID: ${userId}`);

    // Get user information from Directus
    const userResponse = await directusApi.request({
      method: 'GET',
      url: `/users/${userId}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const user = userResponse.data;
    
    // Return sanitized user data
    const userInfo = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar: user.avatar,
      role: user.role,
      status: user.status
    };

    log('auth', `Successfully retrieved user info for: ${user.email}`);
    res.json(userInfo);

  } catch (error: any) {
    log('auth', `Error getting user info: ${error.message}`);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    log('auth', `Login attempt for email: ${email}`);

    // Authenticate with Directus
    const authResponse = await directusApi.request({
      method: 'POST',
      url: '/auth/login',
      data: {
        email: email,
        password: password
      }
    });

    const authData = authResponse.data;

    if (!authData.access_token) {
      throw new Error('No access token received');
    }

    // Get user information with the new token
    const userResponse = await directusApi.request({
      method: 'GET',
      url: '/users/me',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`
      }
    });

    const user = userResponse.data;

    log('auth', `Successful login for user: ${user.email} (ID: ${user.id})`);

    // Return authentication data
    res.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires: authData.expires,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });

  } catch (error: any) {
    log('auth', `Login failed: ${error.message}`);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.status(500).json({ error: 'Login failed' });
  }
});

// User logout
router.post('/logout', authenticateUser, async (req: any, res) => {
  try {
    const token = req.user.token;

    log('auth', `Logout request for user ID: ${req.user.id}`);

    // Logout from Directus
    await directusApi.request({
      method: 'POST',
      url: '/auth/logout',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    log('auth', `Successfully logged out user ID: ${req.user.id}`);
    res.json({ message: 'Logged out successfully' });

  } catch (error: any) {
    log('auth', `Logout error: ${error.message}`);
    // Even if logout fails on server, consider it successful on client
    res.json({ message: 'Logged out successfully' });
  }
});

// Refresh authentication token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    log('auth', 'Token refresh request');

    // Refresh token with Directus
    const refreshResponse = await directusApi.request({
      method: 'POST',
      url: '/auth/refresh',
      data: {
        refresh_token: refresh_token
      }
    });

    const authData = refreshResponse.data;

    log('auth', 'Token refreshed successfully');

    res.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token,
      expires: authData.expires
    });

  } catch (error: any) {
    log('auth', `Token refresh failed: ${error.message}`);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Check authentication status (public route)
router.get('/status', (req: any, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ 
      authenticated: false,
      message: 'No token provided'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Decode JWT token to check validity
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    
    if (!payload.id) {
      throw new Error('Invalid token payload');
    }
    
    res.json({
      authenticated: true,
      user: {
        id: payload.id,
        email: payload.email || 'unknown@email.com',
        role: payload.role
      }
    });
  } catch (error) {
    log('auth', `Token validation failed: ${error}`);
    res.json({ 
      authenticated: false,
      message: 'Invalid token'
    });
  }
});

// Password reset request
router.post('/password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    log('auth', `Password reset request for email: ${email}`);

    // Request password reset from Directus
    await directusApi.request({
      method: 'POST',
      url: '/auth/password/request',
      data: {
        email: email
      }
    });

    log('auth', `Password reset email sent to: ${email}`);
    
    // Always return success for security (don't reveal if email exists)
    res.json({ message: 'If the email exists, a reset link has been sent' });

  } catch (error: any) {
    log('auth', `Password reset request error: ${error.message}`);
    
    // Always return success for security
    res.json({ message: 'If the email exists, a reset link has been sent' });
  }
});

// Reset password with token
router.post('/password-reset/confirm', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    log('auth', 'Password reset confirmation request');

    // Reset password with Directus
    await directusApi.request({
      method: 'POST',
      url: '/auth/password/reset',
      data: {
        token: token,
        password: password
      }
    });

    log('auth', 'Password reset completed successfully');
    res.json({ message: 'Password reset successfully' });

  } catch (error: any) {
    log('auth', `Password reset confirmation error: ${error.message}`);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }
    
    res.status(500).json({ error: 'Password reset failed' });
  }
});

export default router;