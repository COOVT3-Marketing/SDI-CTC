const { chromium, devices } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const randomDelay = (min = 1000, max = 3000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};

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
    const randomSession = Math.floor(10000 + Math.random() * 90000);
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

  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    proxy: proxyConfig
  });

  const context = await browser.newContext({
    ...devices['iPhone 14'],
    locale: 'en-US',
    timezoneId: 'America/New_York',
    hasTouch: true,
    isMobile: true
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  let detectedWebhookUrl = null;

  // Intercept Google Webhook URL dynamically if present
  page.on('request', request => {
    const url = request.url();
    if (url.includes('script.google.com') || url.includes('exec')) {
      detectedWebhookUrl = url;
      console.log(`[FOUND GOOGLE SHEET WEBHOOK URL]: ${url}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('script.google.com') || url.includes('exec')) {
      console.log(`[GOOGLE SHEET RESPONSE]: Status ${response.status()}`);
    }
  });

  try {
    console.log(`Navigating to target page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Prevent call dialer popup from freezing JS execution
    await page.evaluate(() => {
      document.querySelectorAll('a[href^="tel:"]').forEach(a => {
        a.addEventListener('click', (e) => e.preventDefault(), true);
      });
    });

    console.log("Simulating mobile scroll telemetry...");
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await randomDelay(2000, 3000);

    // Physical Hardware Touch Tap
    const callButton = page.locator('a[href^="tel:"], button:has-text("Call"), a:has-text("Call")').first();

    if (await callButton.isVisible({ timeout: 10000 })) {
      await callButton.scrollIntoViewIfNeeded({ behavior: 'smooth' });
      await randomDelay(1000, 2000);

      const box = await callButton.boundingBox();
      if (box) {
        console.log("Executing physical touch tap...");
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await callButton.click({ force: true });
      }
    }

    await page.waitForTimeout(3000);

    // Extract TrustedForm details from DOM and trigger submissionType: CLICK_TO_CALL
    console.log("Extracting payload & sending CLICK_TO_CALL payload to Google Apps Script...");
    
    const submissionResult = await page.evaluate(async (pageUrl) => {
      // Find TrustedForm values
      const certUrl = document.querySelector('input[name="xxTrustedFormCertUrl"]')?.value || 
                      window.xxTrustedFormCertUrl || "";
      const pingUrl = document.querySelector('input[name="xxTrustedFormPingUrl"]')?.value || "";
      
      let token = "";
      if (certUrl) {
        const parts = certUrl.split('/');
        token = parts[parts.length - 1] || "";
      }

      const jornayaId = document.querySelector('input[name="universal_leadid"]')?.value || "";

      // Payload strictly matching Apps Script structure
      const payload = {
        submissionType: "CLICK_TO_CALL",
        ipAddress: "", 
        pageUrl: pageUrl,
        xxTrustedFormUrl: certUrl,
        xxTrustedFormToken: token,
        xxTrustedFormPingUrl: pingUrl,
        jornayaLeadId: jornayaId
      };

      // Dispatch via window.fetch if Google Webhook endpoint is defined in scripts/forms
      const forms = document.querySelectorAll('form');
      let targetEndpoint = "";

      forms.forEach(f => {
        if (f.action && f.action.includes('script.google.com')) {
          targetEndpoint = f.action;
        }
      });

      if (!targetEndpoint && window.googleSheetWebhookUrl) {
        targetEndpoint = window.googleSheetWebhookUrl;
      }

      if (targetEndpoint) {
        try {
          await fetch(targetEndpoint, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          return { success: true, endpoint: targetEndpoint };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      return { success: false, reason: "No direct form endpoint found in client DOM, relying on page click events." };
    }, TARGET_URL);

    console.log("Payload Dispatch Result:", JSON.stringify(submissionResult));

    console.log("Waiting 15 seconds to ensure Apps Script writes to 'Quotes Click-to-Call' tab...");
    await page.waitForTimeout(15000);

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
