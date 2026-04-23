import https from 'https';

/**
 * LinkedIn API Test Script (No Dependencies)
 * 
 * This script tests various LinkedIn API endpoints using built-in https module.
 */

const token = "AQWdA6eF1yU-VSdowutqqIiQfiwCsQgVZuEwSYRTM9VcQ2wdfu-MdKVpef2PTvB6mwk3qaYE5DOeA-x5PtgmEiNHph98gSvnYWliTMbqBIXTq1wqieK5Nma_RT19XfnzcN1wUKuMhDXAfcRII839V3Vw55-TJpNJdNGqX8yKUhaQLjeW4__PmQk55g5lsaQzpKo1wT5gVFvRtCE1QprtfLdJzTG6Hg6FjUPsGNobzKFnaDqm3Lp-vAN57f4vGJelxNOqkeEz8hyPuAuhaIt6cHS_ZIOdzWw0UpFi44zSQe8_LX4yRA2IZjZJy_nHSqMLH5lN9FQKFq2B_BEJCeHSIPmrxlGymQ";

if (!token) {
  console.log('Usage: node test-linkedin.js <ACCESS_TOKEN>');
  process.exit(1);
}

const commonHeaders = {
  'Authorization': `Bearer ${token}`,
  'X-Restli-Protocol-Version': '2.0.0',
  'Content-Type': 'application/json',
  'User-Agent': 'NodeJS'
};

const endpoints = [
  {
    name: "Organization Detail (Combined)",
    url: "https://api.linkedin.com/v2/organizations/101644235?projection=(id,localizedName,vanityName,logoV2(original~:playableStreams))"
  },
  // {
  //   name: "Managed Organizations (ACLs)",
  //   url: "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED"
  // },
  // {
  //   name: "ACLs with Decoration (Full)",
  //   url: "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(*)))"
  // },
  // {
  //   name: "Batch Organizations (Numeric IDs)",
  //   url: "https://api.linkedin.com/v2/organizations?ids=List(101644235)&projection=(results*(id,name))"
  // }
];

function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: commonHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🚀 Starting LinkedIn API diagnostics (Standalone)...\n');

  for (const ep of endpoints) {
    console.log(`Testing: ${ep.name}`);
    console.log(`URL: ${ep.url}`);

    try {
      const start = Date.now();
      const res = await request(ep.url);
      const duration = Date.now() - start;

      if (res.status >= 200 && res.status < 300) {
        console.log(`✅ Success (${duration}ms)`);
        try {
          const json = JSON.parse(res.data);
          console.log('Data:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Raw Data:', res.data);
        }
      } else {
        console.log(`❌ Failed (Status: ${res.status})`);
      }
    } catch (err) {
      console.log(`❌ Request Error: ${err.message}`);
    }
    console.log('-'.repeat(40));
  }
}

runTests();
