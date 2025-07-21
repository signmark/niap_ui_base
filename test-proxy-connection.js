#!/usr/bin/env node

import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'https';

// Test proxy configuration
const PROXY_CONFIG = {
  host: 'mobpool.proxy.market',
  username: 'WeBZDZ7p9lh5',
  password: 'iOPNYl8D',
  country: 'Belarus'
};

async function testProxy(port) {
  const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${port}`;
  console.log(`🔍 Testing proxy: ${PROXY_CONFIG.host}:${port}`);
  
  try {
    const agent = new SocksProxyAgent(proxyUrl);
    
    const options = {
      hostname: 'httpbin.org',
      port: 443,
      path: '/ip',
      method: 'GET',
      agent: agent,
      timeout: 10000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log(`✅ Port ${port}: SUCCESS - IP: ${response.origin}`);
            resolve({ success: true, port, ip: response.origin });
          } catch (e) {
            console.log(`❌ Port ${port}: Invalid response`);
            resolve({ success: false, port, error: 'Invalid response' });
          }
        });
      });

      req.on('error', (error) => {
        console.log(`❌ Port ${port}: ${error.message}`);
        resolve({ success: false, port, error: error.message });
      });

      req.on('timeout', () => {
        console.log(`❌ Port ${port}: Timeout`);
        req.destroy();
        resolve({ success: false, port, error: 'Timeout' });
      });

      req.setTimeout(10000);
      req.end();
    });
  } catch (error) {
    console.log(`❌ Port ${port}: Setup error - ${error.message}`);
    return { success: false, port, error: error.message };
  }
}

async function testMultiplePorts() {
  console.log('🚀 Testing SOCKS5 proxy connections...\n');
  
  const ports = [10000, 10001, 10002, 10003, 10004, 10005];
  const results = [];
  
  for (const port of ports) {
    const result = await testProxy(port);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  }
  
  console.log('\n📊 Summary:');
  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Working ports: ${working.length}`);
  working.forEach(r => console.log(`   Port ${r.port}: ${r.ip}`));
  
  console.log(`❌ Failed ports: ${failed.length}`);
  failed.forEach(r => console.log(`   Port ${r.port}: ${r.error}`));
  
  if (working.length > 0) {
    console.log(`\n🎯 Recommended working port: ${working[0].port}`);
    return working[0].port;
  } else {
    console.log('\n💥 All proxy ports failed!');
    return null;
  }
}

testMultiplePorts().catch(console.error);