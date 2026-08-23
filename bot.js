const { chromium, devices } = require('playwright');

// Target variables passed from the GitHub workflow trigger
const USER_STATE = process.env.USER_STATE || 'California';
const TARGET_URL = process.env.LANDING_PAGE_URL || 'https://securedrive-insurance.com/quotes/';

// Core Decodo Credentials from GitHub Secrets
const PROXY_SERVER = process.env.PROXY_SERVER || 'http://gate.decodo.com:10002';
const BASE_USERNAME = process.env.PROXY_USERNAME || 'spjcjqkpfq';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || 'fmd74wEhNbCr8=1gfE';

// RANDOM DELAY FUNCTION
const randomDelay = (min = 2000, max = 5000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
};

// RANDOM IPHONE MATRIX FOR DEVICE EMULATION
const iosVersions = ['16_5', '16_6', '17_0', '17_2', '17_4_1', '17_5'];
const iphoneModels = ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 15 Pro Max'];

(async () => {
  const randomModel = iphoneModels[Math.floor(Math.random() * iphoneModels.length)];
  const randomVersion = iosVersions[Math.floor(Math.random() * iosVersions.length)];
  const displayVersion = randomVersion.replace(/_/g, '.');
  const customUA = `Mozilla/5.0 (${randomModel}; CPU iPhone OS ${randomVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${displayVersion} Mobile/15E148 Safari/604.1`;

  // AUTOMATIC DECODO STATE TARGETING ENGINE
  let finalUsername = BASE_USERNAME;
  
  if (BASE_USERNAME && USER_STATE) {
    const formattedState = USER_STATE.toLowerCase().trim().replace(/\s+/g, '_');
    const randomSession = Math.floor(10000 + Math.random() * 90000);
    finalUsername = `user-${BASE_USERNAME}-country-us-state-us_${formattedState}-session-${randomSession}`;
  } else {
    const randomSession = Math.floor(10000 + Math.random() * 90000);
    finalUsername = `user-${BASE_USERNAME}-country-us-session-${randomSession}`;
  }

  const proxyConfig = PROXY_SERVER ? {
    server: PROXY_SERVER,
    username: finalUsername,
    password: PROXY_PASSWORD
  } : undefined;

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
    proxy: proxyConfig
  });

  const context = await browser.newContext({
    ...(devices[randomModel.includes('iPhone 15') ? 'iPhone 14 Pro Max' : randomModel] || devices['iPhone 14']),
    userAgent: customUA,
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  const page = await context.newPage();

  try {
    console.log(`Profile Launch: ${randomModel} | iOS ${displayVersion}`);
    if (PROXY_SERVER) {
      console.log(`Targeting geo-location state: ${USER_STATE}`);
      console.log(`Decodo Authenticated User String: ${finalUsername}`);
    }
    
    const startTime = Date.now();
    
    // STEP 1: LOAD LANDING PAGE
    console.log(`Navigating to landing page: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    console.log("Quotes page loaded successfully.");

    // IP Verification Check
    try {
      const geoCheck = await page.evaluate(async () => {
        const res = await fetch('https://ipinfo.io/json');
        return await res.json();
      });
      console.log(`Verified Web Traffic IP: ${geoCheck.ip} (${geoCheck.region}, ${geoCheck.country})`);
    } catch (ipErr) {
      console.log("Could not trace diagnostic IP details, continuing workflow...");
    }

    // STEP 2: HUMAN READING PAUSE
    console.log("Simulating human initial reading pause...");
    await randomDelay(3500, 6500);

    // STEP 3: SMOOTH HUMAN MOBILE SCROLLING
    console.log("Simulating human mobile scrolling through quotes...");
    const scrollCount = Math.floor(Math.random() * 3) + 3;

    for (let i = 1; i <= scrollCount; i++) {
      const scrollDistance = Math.floor(Math.random() * 200) + 180;
      await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), scrollDistance);
      console.log(`Scroll step ${i}/${scrollCount} complete. Reading content...`);
      await randomDelay(2500, 5000);
    }

    // STEP 4: LOCATE CLICK-TO-CALL BUTTON / TEL LINK
    console.log("Searching for Click-to-Call button or tel link...");
    const callLocator = page.locator('a[href^="tel:"], button:has-text("Call"), a:has-text("Call"), .click-to-call, [class*="call"]').first();

    if (await callLocator.isVisible({ timeout: 15000 })) {
      console.log("Call button located! Scrolling into view...");
      await callLocator.scrollIntoViewIfNeeded({ behavior: 'smooth' });
      
      console.log("Human hesitation pause before clicking call button...");
      await randomDelay(2000, 4500);

      console.log("Clicking on Click-to-Call button...");
      await callLocator.click({ delay: Math.floor(Math.random() * 150) + 80 });
      console.log("Click-to-Call action triggered successfully!");
    } else {
      console.log("Call button not found directly, scrolling down to locate...");
      await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
      await randomDelay(2000, 4000);

      if (await callLocator.count() > 0) {
        await callLocator.first().click();
        console.log("Click-to-Call triggered via fallback selector!");
      } else {
        console.log("Warning: Click to call target was not found on quotes page.");
      }
    }

    // STEP 5: POST-ACTION SETTLE DELAY (ANALYTICS & CONVERSION TRACKING)
    console.log("Waiting for tracking events and analytics pixels to register...");
    await randomDelay(5000, 8000);

    const totalSeconds = Math.round((Date.now() - startTime) / 1000);
    console.log(`Workflow completed successfully in ${totalSeconds} seconds.`);

  } catch (error) {
    console.error("Critical Runtime Fault Captured:", error.message);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
