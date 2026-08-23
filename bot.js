const { chromium } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = (process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes').replace(/\/$/, "");

// ⚠️ YAHAN APNA GOOGLE APPS SCRIPT WEB APP URL PUT KAREIN
const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxkjTB8kbypn64nssb-Of8OpcXQ08mrvr7FWWLxc7q5rF0mMVk5_9xBiFi4pR5rJW8Tpw/exec';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const envServer = (process.env.PROXY_SERVER || '').trim().replace(/^["']|["']$/g, '');
  const envUser = (process.env.PROXY_USERNAME || '').trim().replace(/^["']|["']$/g, '');
  const envPass = (process.env.PROXY_PASSWORD || '').trim().replace(/^["']|["']$/g, '');

  const baseServer = envServer.length > 5 ? envServer : DEFAULT_SERVER;
  const baseUsername = envUser.length > 0 ? envUser : DEFAULT_USERNAME;
  const basePassword = envPass.length > 0 ? envPass : DEFAULT_PASSWORD;

  let finalUsername = baseUsername;
  if (USER_STATE) {
    const formattedState = USER_STATE.toLowerCase().trim().replace(/\s+/g, '_');
    const randomSession = getRandomInt(100000, 999999);
    finalUsername = `user-${baseUsername}-country-us-state-us_${formattedState}-session-${randomSession}`;
  }

  let serverUrl = baseServer;
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://') && !serverUrl.startsWith('socks5://')) {
    serverUrl = `http://${serverUrl}`;
  }

  let proxyConfig;
  try {
    const parsed = new URL(serverUrl);
    proxyConfig = {
      server: `${parsed.protocol}//${parsed.host}`,
      username: finalUsername,
      password: basePassword
    };
  } catch (urlErr) {
    proxyConfig = {
      server: DEFAULT_SERVER,
      username: finalUsername,
      password: DEFAULT_PASSWORD
    };
  }

console.log("3. Extracting IP, Tokens & Triggering Webhook Payload...");

    const payloadResult = await page.evaluate(async (webhookUrl) => {
      try {
        // Fetch public IP address directly inside browser context (uses proxy IP)
        let publicIp = "";
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          publicIp = ipData.ip || "";
        } catch (ipErr) {
          console.log("Failed to fetch IP:", ipErr);
        }

        // 1. Extract Full Certificate URL
        const certUrl = document.getElementById('xxTrustedFormCertUrl')?.value || 
                        document.querySelector('input[name="xxTrustedFormCertUrl"]')?.value || "";

        // 2. Extract Ping URL
        const pingUrl = document.getElementById('xxTrustedFormPingUrl_0')?.value || 
                        document.querySelector('input[name="xxTrustedFormPingUrl"]')?.value || "";

        // 3. Extract ONLY clean 40-char token
        let rawToken = document.getElementById('xxTrustedFormToken_0')?.value || "";
        if (!rawToken && certUrl) {
          const match = certUrl.match(/([a-f0-9]{40})/i);
          rawToken = match ? match[1] : "";
        } else if (rawToken.includes('/')) {
          const parts = rawToken.split('/');
          rawToken = parts[parts.length - 1];
        }

        // 4. Extract Jornaya Lead ID
        const jornayaId = document.getElementById('leadid_token')?.value || 
                          document.querySelector('input[name="jornaya_leadid"]')?.value || "";

        const payload = {
          submissionType: "CLICK_TO_CALL",
          ipAddress: publicIp,               // 🎯 Public IP Address Added
          pageUrl: window.location.href,
          xxTrustedFormCertUrl: certUrl,     // Full URL
          xxTrustedFormToken: rawToken,       // Clean Token ID only
          xxTrustedFormPingUrl: pingUrl,     // Full Ping URL
          jornayaLeadId: jornayaId,
          timestamp: new Date().toISOString()
        };

        // Send to Apps Script Webhook
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        return { success: true, payload };
      } catch (err) {
        return { success: false, error: err.toString() };
      }
    }, GOOGLE_WEBHOOK_URL);
  
    if (payloadResult.success) {
      console.log("🎯 [WEBHOOK SENT SUCCESSFULLY]:", JSON.stringify(payloadResult.payload));
    } else {
      console.log("❌ [WEBHOOK FAILED]:", payloadResult.error);
    }

    await delay(3000);

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
