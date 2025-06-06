/**
 * Script to fix campaign_content collection permissions in Directus
 * Grants user access to necessary fields including created_at
 */

import axios from 'axios';

const DIRECTUS_URL = 'https://directus.roboflow.tech';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'lbrspb2024';

async function authenticate() {
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    return response.data.data.access_token;
  } catch (error) {
    console.error('Authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

async function getRoles(token) {
  try {
    const response = await axios.get(`${DIRECTUS_URL}/roles`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching roles:', error.response?.data || error.message);
    return [];
  }
}

async function updatePermissions(token, roleId) {
  try {
    // Получаем существующие права для коллекции campaign_content
    const existingPermissions = await axios.get(`${DIRECTUS_URL}/permissions`, {
      params: {
        filter: JSON.stringify({
          role: { _eq: roleId },
          collection: { _eq: 'campaign_content' }
        })
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (existingPermissions.data.data.length > 0) {
      // Обновляем существующие права
      for (const permission of existingPermissions.data.data) {
        const updateData = {
          fields: ['*'], // Доступ ко всем полям
          permissions: {}
        };

        await axios.patch(`${DIRECTUS_URL}/permissions/${permission.id}`, updateData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`✓ Updated permissions for action: ${permission.action}`);
      }
    } else {
      // Создаем новые права доступа
      const permissions = [
        {
          role: roleId,
          collection: 'campaign_content',
          action: 'read',
          fields: ['*'],
          permissions: {}
        },
        {
          role: roleId,
          collection: 'campaign_content',
          action: 'create',
          fields: ['*'],
          permissions: {}
        },
        {
          role: roleId,
          collection: 'campaign_content',
          action: 'update',
          fields: ['*'],
          permissions: {}
        },
        {
          role: roleId,
          collection: 'campaign_content',
          action: 'delete',
          fields: ['*'],
          permissions: {}
        }
      ];

      for (const permission of permissions) {
        await axios.post(`${DIRECTUS_URL}/permissions`, permission, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`✓ Created permission for action: ${permission.action}`);
      }
    }
  } catch (error) {
    console.error('Error updating permissions:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔧 Fixing campaign_content permissions...');
    
    const token = await authenticate();
    console.log('✓ Authenticated successfully');

    const roles = await getRoles(token);
    console.log(`Found ${roles.length} roles`);

    // Найдем роль пользователя (не администратора)
    const userRole = roles.find(role => 
      role.name && 
      role.name.toLowerCase() !== 'administrator' && 
      role.admin_access === false
    );

    if (!userRole) {
      console.log('Creating default user role...');
      // Создаем роль пользователя если не существует
      const newRole = await axios.post(`${DIRECTUS_URL}/roles`, {
        name: 'User',
        icon: 'supervised_user_circle',
        description: 'Default user role',
        admin_access: false,
        app_access: true
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      await updatePermissions(token, newRole.data.data.id);
    } else {
      console.log(`Updating permissions for role: ${userRole.name} (${userRole.id})`);
      await updatePermissions(token, userRole.id);
    }

    console.log('🎉 Permissions updated successfully!');
    console.log('Users now have access to all campaign_content fields including created_at.');
    
  } catch (error) {
    console.error('❌ Permission update failed:', error.message);
    process.exit(1);
  }
}

main();