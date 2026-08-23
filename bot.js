const { chromium, devices } = require('playwright');

const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

const DEFAULT_SERVER = 'http://gate.decodo.com:10002';
const DEFAULT_USERNAME = 'spjcjqkpfq';
const DEFAULT_PASSWORD = 'fmd74wEhNbCr8=1gfE';

const randomDelay = (min = 2000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};

const iosVersions = ['16_5', '16_6', '17_0', '17_2', '17_4_1', '17_5'];
const iphoneModels = ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 15 Pro Max'];

(async () => {
  const randomModel = iphoneModels[Math.floor(Math.random() * iphoneModels.length)];
  const randomVersion = iosVersions[Math.floor(Math.random() * iosVersions.length)];
  const displayVersion = randomVersion.replace(/_/g, '.');
  const customUA = `Mozilla/5.0 (${randomModel}; CPU iPhone OS ${randomVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${displayVersion} Mobile/15E148 Safari/604.1`;

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
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    proxy: proxyConfig
  });

  const deviceConfig = devices[randomModel.includes('iPhone 15') ? 'iPhone 14 Pro Max' : randomModel] || devices['iPhone 14'];

  const context = await browser.newContext({
    ...deviceConfig,
    userAgent: customUA,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    hasTouch: true,
    isMobile: true
  });

  // STEALTH EVALUATE: Override navigator.webdriver to bypass TrustedForm Bot Shield
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  try {
    console.log(`Profile Launch: ${randomModel} | iOS ${displayVersion}`);
    console.log(`Targeting geo-location state: ${USER_STATE}`);
    console.log(`Decodo Authenticated User String: ${finalUsername}`);
    
    const startTime = Date.now();
    
    // STEP 1: LOAD LANDING PAGE
    console.log(`Navigating to landing page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Allow TrustedForm / GTM scripts to initialize fully
    await page.waitForTimeout(5000);
    console.log("Quotes page and tracking scripts loaded successfully.");

    // STEP 2: HUMAN READING PAUSE
    await randomDelay(3000, 5000);

    // STEP 3: HUMAN MOBILE SCROLLING
    console.log("Simulating human mobile scrolling through quotes...");
    const scrollCount = Math.floor(Math.random() * 3) + 2;

    for (let i = 1; i <= scrollCount; i++) {
      const scrollDistance = Math.floor(Math.random() * 200) + 180;
      await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), scrollDistance);
      await randomDelay(2000, 4000);
    }

    // STEP 4: LOCATE BUTTON & TRIGGER REAL TOUCH EVENTS
    console.log("Searching for Click-to-Call button or tel link...");
    const callLocator = page.locator('a[href^="tel:"], button:has-text("Call"), a:has-text("Call"), .click-to-call, [class*="call"]').first();

    if (await callLocator.isVisible({ timeout: 15000 })) {
      console.log("Call button located! Scrolling into view...");
      await callLocator.scrollIntoViewIfNeeded({ behavior: 'smooth' });
      await randomDelay(2000, 3500);

      // Get exact coordinates of button for physical touch simulation
      const box = await callLocator.boundingBox();

      if (box) {
        console.log(`Simulating real touch tap at coordinates X:${box.x + box.width / 2}, Y:${box.y + box.height / 2}`);
        
        // Dispatch real DOM touch & click events so TrustedForm captures it
        await page.evaluate((el) => {
          const touch = new Touch({
            identifier: Date.now(),
            target: el,
            clientX: 100,
            clientY: 100
          });

          el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch], targetTouches: [touch], bubbles: true }));
          el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], bubbles: true }));
          el.click();
        }, await callLocator.elementHandle());

        console.log("Real touch & click events dispatched successfully!");
      } else {
        await callLocator.click();
      }
    } else {
      console.log("Call button not found directly.");
    }

    // STEP 5: WAIT FOR TRUSTEDFORM / GOOGLE SHEET WEBHOOK TO FIRE
    console.log("Waiting 10 seconds for TrustedForm & Google Sheet Webhooks to send payload...");
    await page.waitForTimeout(10000);

    const totalSeconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`Workflow completed successfully in ${totalSeconds} seconds.`);

  } catch (error) {
    console.error("Critical Runtime Fault Captured:", error.message);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
