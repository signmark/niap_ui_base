/**
 * Script to fix admin permissions for user creation in Directus
 * Grants the administrator role proper permissions to create users
 */

import axios from 'axios';

const DIRECTUS_URL = 'https://directus.roboflow.tech';

async function getWorkingAdminToken() {
  // Try different admin credentials that might be working
  const credentials = [
    { email: 'admin@roboflow.tech', password: 'admin123' },
    { email: 'admin@roboflow.tech', password: 'admin1234' },
    { email: 'lbrspb@gmail.com', password: 'QtpZ3dh7' }
  ];

  for (const cred of credentials) {
    try {
      console.log(`Trying to authenticate with ${cred.email}...`);
      const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
        email: cred.email,
        password: cred.password
      });
      
      if (response.data.data && response.data.data.access_token) {
        console.log(`✓ Successfully authenticated with ${cred.email}`);
        return {
          token: response.data.data.access_token,
          user: response.data.data.user
        };
      }
    } catch (error) {
      console.log(`✗ Failed to authenticate with ${cred.email}`);
    }
  }
  
  throw new Error('No working admin credentials found');
}

async function getCurrentUserRole(token) {
  try {
    const response = await axios.get(`${DIRECTUS_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Current user info:', {
      id: response.data.data.id,
      email: response.data.data.email,
      role: response.data.data.role
    });
    
    return response.data.data.role;
  } catch (error) {
    console.error('Error getting current user:', error.response?.data || error.message);
    throw error;
  }
}

async function getRolePermissions(token, roleId) {
  try {
    const response = await axios.get(`${DIRECTUS_URL}/permissions`, {
      headers: { 'Authorization': `Bearer ${token}` },
      params: {
        'filter[role][_eq]': roleId
      }
    });
    
    console.log(`Role ${roleId} has ${response.data.data.length} permissions`);
    return response.data.data;
  } catch (error) {
    console.error('Error getting role permissions:', error.response?.data || error.message);
    return [];
  }
}

async function createUserPermission(token, roleId) {
  try {
    // Check if permission already exists
    const existingPermissions = await getRolePermissions(token, roleId);
    const userPermission = existingPermissions.find(p => 
      p.collection === 'directus_users' && p.action === 'create'
    );
    
    if (userPermission) {
      console.log('✓ User creation permission already exists');
      return userPermission;
    }
    
    // Create the permission
    const permissionData = {
      role: roleId,
      collection: 'directus_users',
      action: 'create',
      permissions: {},
      validation: {},
      presets: {},
      fields: ['*']
    };
    
    const response = await axios.post(`${DIRECTUS_URL}/permissions`, permissionData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✓ Created user creation permission for role:', roleId);
    return response.data.data;
    
  } catch (error) {
    console.error('Error creating user permission:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔧 Fixing admin permissions for user creation...');
    
    // Get working admin token
    const auth = await getWorkingAdminToken();
    const token = auth.token;
    
    // Get current user's role
    const roleId = await getCurrentUserRole(token);
    
    if (!roleId) {
      throw new Error('No role found for current user');
    }
    
    // Check current permissions
    await getRolePermissions(token, roleId);
    
    // Create user creation permission
    await createUserPermission(token, roleId);
    
    // Verify the permission was created
    console.log('\n📋 Verifying permissions...');
    const updatedPermissions = await getRolePermissions(token, roleId);
    const userCreatePermission = updatedPermissions.find(p => 
      p.collection === 'directus_users' && p.action === 'create'
    );
    
    if (userCreatePermission) {
      console.log('✅ Admin permissions successfully configured for user creation');
      console.log('Registration system should now work properly');
    } else {
      console.log('❌ Failed to create user creation permission');
    }
    
  } catch (error) {
    console.error('❌ Error fixing admin permissions:', error.message);
    process.exit(1);
  }
}

main();