const { chromium } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

// YAHAN APNA GOOGLE APPS SCRIPT WEB APP URL DAALEN
const GOOGLE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxkjTB8kbypn64nssb-Of8OpcXQ08mrvr7FWWLxc7q5rF0mMVk5_9xBiFi4pR5rJW8Tpw/exec';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  try {
    console.log(`1. Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);

    // Human Scroll
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await delay(2000);

    console.log("2. Waiting for TrustedForm & Jornaya Tokens...");
    await page.waitForFunction(() => {
      const tfCert = document.getElementById('xxTrustedFormCertUrl')?.value || document.querySelector('input[name="xxTrustedFormCertUrl"]')?.value;
      const jToken = document.getElementById('leadid_token')?.value || document.querySelector('input[name="jornaya_leadid"]')?.value;
      return Boolean(tfCert || jToken);
    }, { timeout: 15000 }).catch(() => console.log("⚠️ Token loading timed out. Extracting whatever is available..."));

    console.log("3. Extracting Tokens & Triggering Webhook directly via Bot...");
    
    // Direct Webhook Trigger via Bot Page Context
    const success = await page.evaluate(async (webhookUrl) => {
      try {
        const certUrl = document.getElementById('xxTrustedFormCertUrl')?.value || 
                        document.querySelector('input[name="xxTrustedFormCertUrl"]')?.value || "";
                        
        const pingUrl = document.getElementById('xxTrustedFormPingUrl_0')?.value || 
                        document.querySelector('input[name="xxTrustedFormPingUrl"]')?.value || "";

        let rawToken = document.getElementById('xxTrustedFormToken_0')?.value || "";
        if (!rawToken && certUrl.includes('/')) {
          const parts = certUrl.split('/');
          rawToken = parts[parts.length - 1] || "";
        }

        const jornayaId = document.getElementById('leadid_token')?.value || 
                          document.querySelector('input[name="jornaya_leadid"]')?.value || "";

        const payload = {
          submissionType: "CLICK_TO_CALL",
          ipAddress: "",
          pageUrl: window.location.href,
          xxTrustedFormCertUrl: certUrl,
          xxTrustedFormToken: rawToken,
          xxTrustedFormPingUrl: pingUrl,
          jornayaLeadId: jornayaId
        };

        // Send directly to Google Apps Script
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        return true;
      } catch (err) {
        return false;
      }
    }, GOOGLE_WEBHOOK_URL);

    console.log(success ? "✅ Webhook successfully sent to Google Sheet!" : "❌ Failed to send webhook.");
    await delay(5000);

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
