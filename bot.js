const { chromium } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getRandomMobileProfile = () => {
  const mobileDevices = [
    {
      name: 'iPhone 14 Pro',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    },
    {
      name: 'Samsung Galaxy S22',
      userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    }
  ];
  return mobileDevices[getRandomInt(0, mobileDevices.length - 1)];
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

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
    proxy: proxyConfig
  });

  const mobileProfile = getRandomMobileProfile();
  console.log(`[PROFILE LOADED]: ${mobileProfile.name}`);

  const context = await browser.newContext({
    userAgent: mobileProfile.userAgent,
    viewport: mobileProfile.viewport,
    deviceScaleFactor: mobileProfile.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  // Monitor for Google Sheet Webhook Execution
  page.on('response', response => {
    const url = response.url();
    if (url.includes('script.google.com') || url.includes('exec')) {
      console.log(`🎯 [GOOGLE SHEET WEBHOOK SUCCESS]: Status ${response.status()} -> ${url}`);
    }
  });

  try {
    console.log(`1. Navigating to landing page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000);

    // Prevent 'tel:' link from opening system dialer popup
    await page.evaluate(() => {
      window.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="tel:"]');
        if (link) {
          e.preventDefault();
          console.log("Captured tel link click natively without breaking JS execution.");
        }
      }, true);
    });

    console.log("2. Simulating Human Research Behavior (Scrolling & Pausing)...");
    
    // Smooth Scroll Down (Node scope values passed explicitly)
    const scrollAmount1 = getRandomInt(200, 400);
    await page.evaluate((amt) => window.scrollBy({ top: amt, behavior: 'smooth' }), scrollAmount1);
    await delay(getRandomInt(2000, 3000));

    // Touch Tap Simulation
    await page.touchscreen.tap(getRandomInt(100, 250), getRandomInt(200, 400));
    await delay(getRandomInt(1500, 2500));

    // Smooth Scroll Down 2
    const scrollAmount2 = getRandomInt(300, 500);
    await page.evaluate((amt) => window.scrollBy({ top: amt, behavior: 'smooth' }), scrollAmount2);
    await delay(getRandomInt(2000, 3000));

    // Scroll slightly up
    await page.evaluate(() => window.scrollBy({ top: -150, behavior: 'smooth' }));
    await delay(2000);

    console.log("3. Locating Call CTA Button...");
    const callButton = page.locator('a[href^="tel:"], button:has-text("Call"), a:has-text("Call")').first();

    if (await callButton.isVisible({ timeout: 10000 })) {
      await callButton.scrollIntoViewIfNeeded({ behavior: 'smooth' });
      await delay(1500);

      const box = await callButton.boundingBox();
      if (box) {
        console.log("4. Executing Native Human Touch Tap on Call Button...");
        const tapX = box.x + box.width / 2;
        const tapY = box.y + box.height / 2;
        
        await page.touchscreen.tap(tapX, tapY);
        console.log("Touch Tap Dispatched!");
      } else {
        await callButton.click();
      }

      await delay(3000);

      // FORCE TRIGGER CLICK_TO_CALL TO GOOGLE SHEET WEBHOOK IF DOM LISTENER SKIPPED
      console.log("5. Triggering Click-To-Call Webhook Event with TrustedForm Certificate...");
      await page.evaluate(async (pageUrl) => {
        const certUrl = document.querySelector('input[name="xxTrustedFormCertUrl"]')?.value || 
                        window.xxTrustedFormCertUrl || "";
        const pingUrl = document.querySelector('input[name="xxTrustedFormPingUrl"]')?.value || "";
        
        let token = "";
        if (certUrl) {
          const parts = certUrl.split('/');
          token = parts[parts.length - 1] || "";
        }

        const jornayaId = document.querySelector('input[name="universal_leadid"]')?.value || "";

        const payload = {
          submissionType: "CLICK_TO_CALL",
          ipAddress: "",
          pageUrl: pageUrl,
          xxTrustedFormUrl: certUrl,
          xxTrustedFormToken: token,
          xxTrustedFormPingUrl: pingUrl,
          jornayaLeadId: jornayaId
        };

        // If page has a global submit function or form action to google script
        const forms = document.querySelectorAll('form');
        forms.forEach(f => {
          if (f.action && f.action.includes('script.google.com')) {
            fetch(f.action, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }).catch(() => {});
          }
        });
      }, TARGET_URL);

      console.log("Waiting 15 seconds for Google Apps Script to write to Sheet...");
      await delay(15000);

    } else {
      console.log("❌ Call CTA button not found on page.");
    }

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
