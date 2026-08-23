const { chromium } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Random Mobile Profiles Generator
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

  // Monitor Network Responses for Google Apps Script Webhook
  page.on('response', response => {
    const url = response.url();
    if (url.includes('script.google.com') || url.includes('exec')) {
      console.log(`🎯 [GOOGLE SHEET WEBHOOK SUCCESS]: Status ${response.status()} -> ${url}`);
    }
  });

  try {
    console.log(`1. Navigating to landing page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(getRandomInt(3000, 5000));

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

    // HUMAN BEHAVIOR SIMULATION (Research & Reading Phase)
    console.log("2. Simulating Human Research Behavior (Scrolling & Pausing)...");
    
    // Scroll Down 1
    await page.evaluate(() => window.scrollBy({ top: getRandomInt(200, 400), behavior: 'smooth' }));
    await delay(getRandomInt(2000, 4000)); // Reading time

    // Touch gesture on content
    await page.touchscreen.tap(getRandomInt(100, 250), getRandomInt(200, 400));
    await delay(getRandomInt(1500, 3000));

    // Scroll Down 2
    await page.evaluate(() => window.scrollBy({ top: getRandomInt(300, 500), behavior: 'smooth' }));
    await delay(getRandomInt(3000, 5000)); // Reading time

    // Scroll slightly up (human re-reading)
    await page.evaluate(() => window.scrollBy({ top: -150, behavior: 'smooth' }));
    await delay(getRandomInt(2000, 3000));

    // LOCATE CLICK-TO-CALL BUTTON
    console.log("3. Locating Call CTA Button...");
    const callButton = page.locator('a[href^="tel:"], button:has-text("Call"), a:has-text("Call")').first();

    if (await callButton.isVisible({ timeout: 10000 })) {
      await callButton.scrollIntoViewIfNeeded({ behavior: 'smooth' });
      await delay(getRandomInt(1500, 3000));

      const box = await callButton.boundingBox();
      if (box) {
        console.log("4. Executing Native Human Touch Tap on Call Button...");
        const tapX = box.x + box.width / 2 + getRandomInt(-5, 5);
        const tapY = box.y + box.height / 2 + getRandomInt(-3, 3);
        
        // Dispatch real physical touch event
        await page.touchscreen.tap(tapX, tapY);
        console.log("Tap Event Dispatched Successfully!");
      } else {
        await callButton.click();
      }

      // Allow site's internal JavaScript to trigger Google Sheet Webhook / AJAX
      console.log("5. Waiting for page scripts to process TrustedForm & send payload to Google Sheet...");
      await delay(12000);

    } else {
      console.log("❌ Call CTA button not found on page.");
    }

  } catch (error) {
    console.error("Execution Error:", error.message);
  } finally {
    await browser.close();
  }
})();
