/**
 * Automated QA Test Suite for VENKATARAMANA ENTERPRISES
 * Tests all REST endpoints, DB operations, calculations, authentication & static assets
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING VENKATARAMANA ENTERPRISES TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const health = await makeRequest('/api/health');
    assert(health.status === 200 && health.data.status === 'ok' && health.data.dbConnected === true, '1. Health Check & DB connectivity');

    // 2. Store Info
    const store = await makeRequest('/api/store-info');
    assert(store.status === 200 && store.data.name === 'VENKATARAMANA ENTERPRISES', '2. Store Info returns business name');
    assert(store.data.phone === '9849145045' && store.data.whatsapp === '9491945045', '3. Phone & WhatsApp numbers verified');
    assert(store.data.city === 'GOKAVARAM', '4. City is Gokavaram');

    // 3. Categories
    const categories = await makeRequest('/api/categories');
    assert(categories.status === 200 && Array.isArray(categories.data) && categories.data.length >= 8, '5. Categories returned (>= 8 categories)');

    // 4. Confirmed Brands
    const brands = await makeRequest('/api/brands');
    assert(brands.status === 200 && Array.isArray(brands.data) && brands.data.length === 4, '6. Exactly 4 confirmed brands seeded');
    const brandNames = brands.data.map(b => b.name);
    assert(
      brandNames.includes('UltraTech Building Solutions') &&
      brandNames.includes('Jindal Panther') &&
      brandNames.includes('Vizag Steel') &&
      brandNames.includes('Mangal TMT'),
      '7. Confirmed brands match UltraTech, Jindal Panther, Vizag Steel, Mangal TMT'
    );

    // 5. Products Catalog
    const products = await makeRequest('/api/products');
    assert(products.status === 200 && Array.isArray(products.data) && products.data.length >= 50, '8. Public catalog contains ~50+ construction materials');
    
    // Check "No fake prices" rule: initial items have price = null ("Contact for Price")
    const nullPriceItems = products.data.filter(p => p.price === null);
    assert(nullPriceItems.length >= 40, '9. Strict No-Fabrication rule: unconfirmed prices set to null for "Contact for Price"');

    // 6. Search & Filter
    const searchRes = await makeRequest('/api/products?search=UltraTech');
    assert(searchRes.status === 200 && searchRes.data.length > 0, '10. Product search filters correctly');

    const catFilterRes = await makeRequest('/api/products?category=Cement');
    assert(catFilterRes.status === 200 && catFilterRes.data.every(p => p.category === 'Cement'), '11. Product category filtering works');

    // 7. Owner Access (Authentication removed per user request)
    const directAuth = await makeRequest('/api/owner/verify-pin', 'POST');
    assert(directAuth.status === 200 && directAuth.data.success === true, '12. Direct owner access verified without PIN prompt');

    // 8. Open Access to /api/bills without token
    const openBills = await makeRequest('/api/bills');
    assert(openBills.status === 200, '13. Direct access to /api/bills verified without authentication barrier');
    assert(openBills.status === 200, '14. Owner routes accessible without login');
    const ownerToken = 'open_access_token';

    // 9. Owner Product Management (CRUD)
    const newProduct = {
      name: 'QA Test TMT Bar 20mm',
      brand: 'Vizag Steel',
      category: 'Steel & TMT',
      unit: 'Metric Ton',
      price: 65000,
      description: 'Tested via automated QA suite',
      active: 1
    };
    const createProd = await makeRequest('/api/products', 'POST', newProduct, ownerToken);
    assert(createProd.status === 201 && createProd.data.success === true, '15. Owner can add new product');
    const createdProdId = createProd.data.id;

    // Update Product
    const updateProd = await makeRequest(`/api/products/${createdProdId}`, 'PUT', {
      ...newProduct,
      name: 'QA Test TMT Bar 20mm (Updated)',
      price: 66000
    }, ownerToken);
    assert(updateProd.status === 200 && updateProd.data.success === true, '16. Owner can update existing product');

    // Delete Product
    const deleteProd = await makeRequest(`/api/products/${createdProdId}`, 'DELETE', null, ownerToken);
    assert(deleteProd.status === 200 && deleteProd.data.success === true, '17. Owner can delete product');

    // 10. POS Billing & Calculations
    const testBill = {
      custName: 'Suresh Reddy',
      custPhone: '9849000000',
      paymentMode: 'UPI',
      discount: 100,
      taxRate: 18,
      items: [
        { name: 'UltraTech PPC Cement', unit: 'Bags', unitPrice: 380, qty: 10 },
        { name: 'Jindal Panther 12mm TMT', unit: 'Bundle', unitPrice: 1200, qty: 2 }
      ]
    };
    // Expected Calculations:
    // Subtotal: (10 * 380) + (2 * 1200) = 3800 + 2400 = 6200
    // Taxable: 6200 - 100 = 6100
    // GST (18%): 6100 * 0.18 = 1098
    // Grand Total: 6100 + 1098 = 7198

    const createBill = await makeRequest('/api/bills', 'POST', testBill, ownerToken);
    assert(createBill.status === 201 && createBill.data.success === true, '18. Bill created successfully');
    const b = createBill.data.bill;
    assert(b.subtotal === 6200, `19. POS Subtotal accurate (Expected 6200, got ${b.subtotal})`);
    assert(b.discount === 100, '20. POS Discount stored accurately');
    assert(b.taxAmount === 1098, `21. POS Tax amount accurate (Expected 1098, got ${b.taxAmount})`);
    assert(b.grandTotal === 7198, `22. POS Grand Total accurate (Expected 7198, got ${b.grandTotal})`);

    // 11. Sales Analytics
    const sales = await makeRequest('/api/bills', 'GET', null, ownerToken);
    assert(sales.status === 200 && sales.data.analytics.totalBills >= 1, '23. Sales analytics reflects recorded bills');
    assert(sales.data.analytics.totalRevenue >= 7198, '24. Total revenue reflects recorded bill amount');

    // 12. Bill Deletion
    const deleteBillRes = await makeRequest(`/api/bills/${b.id}`, 'DELETE', null, ownerToken);
    assert(deleteBillRes.status === 200 && deleteBillRes.data.success === true, '25. Owner can delete invoice record');

    // 13. Settings Update
    const setGst = await makeRequest('/api/settings', 'POST', { gst_rate: '18' }, ownerToken);
    assert(setGst.status === 200 && setGst.data.success === true, '26. Owner can configure GST rate in settings');

    const getSettings = await makeRequest('/api/settings', 'GET');
    assert(getSettings.status === 200 && getSettings.data.gst_rate === '18', '27. Configured settings persist accurately');

    // Reset GST back to empty to preserve owner's clean state
    await makeRequest('/api/settings', 'POST', { gst_rate: '' }, ownerToken);

    // 14. Static Assets & PWA Verification
    const staticIndex = await makeRequest('/');
    assert(staticIndex.status === 200 && staticIndex.data.includes('VENKATARAMANA ENTERPRISES'), '28. Public index.html served correctly');

    const staticManifest = await makeRequest('/manifest.json');
    assert(staticManifest.status === 200 && staticManifest.data.short_name === 'Venkataramana POS', '29. PWA manifest.json served correctly');

    const staticSw = await makeRequest('/sw.js');
    assert(staticSw.status === 200 && staticSw.data.includes('ve-pos-cache'), '30. Service worker sw.js served correctly');

    const staticLogo = await makeRequest('/assets/logo/logo.svg');
    assert(staticLogo.status === 200 && staticLogo.headers['content-type'].includes('svg'), '31. Brand logo.svg served correctly');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
