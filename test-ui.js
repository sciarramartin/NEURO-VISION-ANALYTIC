const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function run() {
  const artifactDir = 'C:\\Users\\arrai\\.gemini\\antigravity\\brain\\8a73fa0d-6516-4b49-830c-e85502d122d0';
  
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    defaultViewport: { width: 1280, height: 850 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Handle alerts/dialogs automatically to prevent blocking the thread
  page.on('dialog', async dialog => {
    console.log(`[Browser Dialog]: [${dialog.type()}] - ${dialog.message()}`);
    await dialog.accept();
  });
  
  try {
    // 1. Test Dashboard (Home)
    console.log('Navigating to Dashboard...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.app-container');
    
    // Wait for layout and mock data load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Taking dashboard screenshot...');
    await page.screenshot({ path: path.join(artifactDir, 'dashboard.png') });

    // 2. Test Capture Page (Face mode)
    console.log('Navigating to Capture Page...');
    await page.goto('http://localhost:3000/capture', { waitUntil: 'networkidle2' });
    await page.waitForSelector('select.select-input');
    
    // Wait for patient options to load dynamically (more than just the placeholder option)
    await page.waitForFunction(() => {
      const selects = Array.from(document.querySelectorAll('select.select-input'));
      const patientSelect = selects.find(s => {
        const values = Array.from(s.options).map(o => o.value);
        return !values.includes('admin') && !values.includes('patient');
      });
      return patientSelect && patientSelect.options.length > 1;
    });

    // Select the first valid option dynamically from patient select
    const patientSelection = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select.select-input'));
      const patientSelect = selects.find(s => {
        const values = Array.from(s.options).map(o => o.value);
        return !values.includes('admin') && !values.includes('patient');
      });
      if (!patientSelect) return { value: '', index: -1 };
      
      // Return first option with value (skip index 0 placeholder if it is "Seleccione...")
      for (let i = 0; i < patientSelect.options.length; i++) {
        if (patientSelect.options[i].value) {
          return { value: patientSelect.options[i].value, index: i };
        }
      }
      return { value: '', index: -1 };
    });

    console.log(`Dynamic patient selected value: "${patientSelection.value}" (Index: ${patientSelection.index})`);
    
    if (patientSelection.value) {
      // Select using option value in the patient dropdown
      await page.evaluate((val) => {
        const selects = Array.from(document.querySelectorAll('select.select-input'));
        const patientSelect = selects.find(s => {
          const values = Array.from(s.options).map(o => o.value);
          return !values.includes('admin') && !values.includes('patient');
        });
        if (patientSelect) {
          patientSelect.value = val;
          patientSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, patientSelection.value);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Click "PRE" mode button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const preBtn = buttons.find(b => b.textContent.includes('PRE'));
      if (preBtn) preBtn.click();
    });
    
    // Click "GRABAR" to start face simulator recording
    console.log('Starting Face Recording simulation...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const recordBtn = buttons.find(b => b.textContent.includes('GRABAR'));
      if (recordBtn) recordBtn.click();
    });
    
    // Wait for 3 seconds of recording simulation
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    // Click "DETENER"
    console.log('Stopping recording...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const stopBtn = buttons.find(b => b.textContent.includes('DETENER'));
      if (stopBtn) stopBtn.click();
    });
    
    // Wait for results calculations to render
    await page.waitForSelector('.border-emerald-500\\/30');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Taking capture face results screenshot...');
    await page.screenshot({ path: path.join(artifactDir, 'capture_face.png') });

    // 3. Test Capture Page (Body mode - CODO)
    console.log('Switching region to CODO (Elbow)...');
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select.select-input'));
      const patientSelect = selects.find(s => {
        const values = Array.from(s.options).map(o => o.value);
        return !values.includes('admin') && !values.includes('patient');
      });
      const otherSelects = selects.filter(s => s !== patientSelect && !s.className.includes('py-1.5'));
      const regionSelect = otherSelects[0] || document.querySelector('select'); // Region dropdown
      
      if (regionSelect) {
        regionSelect.value = 'CODO';
        regionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Wait for model selection state
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Click "GRABAR" again for elbow joint simulation
    console.log('Starting Body (Elbow) Recording simulation...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const recordBtn = buttons.find(b => b.textContent.includes('GRABAR'));
      if (recordBtn) recordBtn.click();
    });
    
    // Wait for 3 seconds of body simulation
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    // Click "DETENER"
    console.log('Stopping body recording...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const stopBtn = buttons.find(b => b.textContent.includes('DETENER'));
      if (stopBtn) stopBtn.click();
    });
    
    // Wait for results
    await page.waitForSelector('.border-emerald-500\\/30');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Taking capture body results screenshot...');
    await page.screenshot({ path: path.join(artifactDir, 'capture_body.png') });

    // 4. Test Trends Page
    console.log('Navigating to Trends Page for patient...');
    const targetPatientId = patientSelection.value || 'mock-p1';
    await page.goto(`http://localhost:3000/trends?patientId=${targetPatientId}`, { waitUntil: 'networkidle2' });
    
    // Wait for charts to animate/render
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    console.log('Taking trends evolution screenshot...');
    await page.screenshot({ path: path.join(artifactDir, 'trends.png') });

    console.log('All tests completed successfully!');

  } catch (err) {
    console.error('Test error occurred:', err);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

run();
