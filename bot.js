const { chromium } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = (process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes').replace(/\/$/, "");
const GOOGLE_WEBHOOK_URL = process.env.GOOGLE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxkjTB8kbypn64nssb-Of8OpcXQ08mrvr7FWWLxc7q5rF0mMVk5_9xBiFi4pR5rJW8Tpw/exec';
const USER_PHONE = process.env.USER_PHONE || ''; // Node.js environment se phone number yahan uthaya

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

  console.log(`[PROXY CONFIG]: Routing through ${proxyConfig.server} | Session: ${finalUsername}`);

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    proxy: proxyConfig
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    console.log(`1. Navigating to landing page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);

    console.log("2. Simulating realistic human scrolling & reading behavior...");

    const scrollSteps = [350, 750, 1200, 1600, 2100];
    for (const pos of scrollSteps) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), pos);
      await page.mouse.move(getRandomInt(50, 300), getRandomInt(100, 500)).catch(() => {});
      
      const stepPause = getRandomInt(3500, 5000);
      console.log(`    Scrolled to Y:${pos} | Reading for ${(stepPause / 1000).toFixed(1)}s...`);
      await delay(stepPause);
    }

    console.log("3. Scrolling back up to the Click-to-Call card section...");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await delay(2000);

    // Wait for TrustedForm / Jornaya tokens to fully load
    await page.waitForFunction(() => {
      const tf = document.getElementById('xxTrustedFormCertUrl')?.value || document.querySelector('input[name="xxTrustedFormCertUrl"]')?.value;
      const jn = document.getElementById('leadid_token')?.value || document.querySelector('input[name="jornaya_leadid"]')?.value;
      return Boolean(tf || jn);
    }, { timeout: 15000 }).catch(() => console.log("⚠️ Token load timeout. Proceeding with current DOM state..."));

    // Guarantee full 35 to 40 seconds time on page BEFORE the final click
    const targetSessionTime = getRandomInt(36000, 40000);
    const elapsedSoFar = Date.now() - startTime;
    const remainingDelay = targetSessionTime - elapsedSoFar;

    if (remainingDelay > 0) {
      console.log(`⏱️ Maintaining reading session... Waiting ${(remainingDelay / 1000).toFixed(1)}s to reach ${targetSessionTime / 1000}s total session time.`);
      await delay(remainingDelay);
    }

    console.log("4. Final Action: Clicking the Click-to-Call button/card at the end of session...");
    const callBtn = page.locator('a[href^="tel:"], button:has-text("Call"), a:has-text("Call"), .click-to-call').first();
    if (await callBtn.count() > 0) {
      await callBtn.click({ force: true }).catch(() => {});
    } else {
      await page.mouse.click(196, 400).catch(() => {});
    }

    await delay(1500); // Short pause to register click event on TrustedForm DOM tracker

    console.log("5. Extracting IP, Tokens & Triggering Webhook Payload...");

    // Yahan webhookUrl aur userPhone dono ko as an object pass kar diya hai browser ke andar
    const payloadResult = await page.evaluate(async ({ webhookUrl, userPhone }) => {
      try {
        let publicIp = "";
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          publicIp = ipData.ip || "";
        } catch (ipErr) {
          console.log("Failed to fetch IP:", ipErr);
        }

        const certUrl = document.getElementById('xxTrustedFormCertUrl')?.value || 
                        document.querySelector('input[name="xxTrustedFormCertUrl"]')?.value || "";

        const pingUrl = document.getElementById('xxTrustedFormPingUrl_0')?.value || 
                        document.querySelector('input[name="xxTrustedFormPingUrl"]')?.value || "";

        let rawToken = document.getElementById('xxTrustedFormToken_0')?.value || "";
        if (!rawToken && certUrl) {
          const match = certUrl.match(/([a-f0-9]{40})/i);
          rawToken = match ? match[1] : "";
        } else if (rawToken.includes('/')) {
          const parts = rawToken.split('/');
          rawToken = parts[parts.length - 1];
        }

        const jornayaId = document.getElementById('leadid_token')?.value || 
                          document.querySelector('input[name="jornaya_leadid"]')?.value || "";

        const payload = {
          submissionType: "CLICK_TO_CALL",
          phone: userPhone, // Ab yahan safely pass ho raha hai
          ipAddress: publicIp,
          pageUrl: window.location.href,
          xxTrustedFormUrl: certUrl,
          xxTrustedFormToken: rawToken,
          xxTrustedFormPingUrl: pingUrl,
          jornayaLeadId: jornayaId,
          timestamp: new Date().toISOString()
        };

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
    }, { webhookUrl: GOOGLE_WEBHOOK_URL, userPhone: USER_PHONE });

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
