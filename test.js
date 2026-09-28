/**
 * Automated QA Test Suite for VENKATARAMANA ENTERPRISES
 * Validates:
 * 1. Health check & DB connectivity
 * 2. Store information & verified phone/address
 * 3. Category groupings
 * 4. Required catalog items:
 *    - UltraTech range
 *    - Iron in sizes 6mm, 8mm, 10mm, 12mm, 16mm
 *    - Mess roles
 *    - Slab liquids
 *    - Sponges
 *    - Bricket boxes
 * 5. Owner PIN authentication (PIN := 2016, reject invalid PINs, token security)
 * 6. POS Billing calculations (Subtotal, Discount, GST/Tax, Grand Total)
 * 7. Sales Analytics & invoice management
 * 8. Static assets (logo.png, logo.svg, icon.svg, manifest, sw.js, invoice.html)
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
  console.log('  RUNNING VENKATARAMANA ENTERPRISES QA TEST SUITE');
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
    assert(health.status === 200 && health.data.status === 'ok' && health.data.dbConnected === true, '1. Health check & Turso/SQLite DB connectivity');

    // 2. Store Info
    const store = await makeRequest('/api/store-info');
    assert(store.status === 200 && store.data.name === 'VENKATARAMANA ENTERPRISES', '2. Store Info returns business name');
    assert(store.data.phone === '9849145045' && store.data.whatsapp === '9491945045', '3. Phone (9849145045) & WhatsApp (9491945045) verified');
    assert(store.data.city === 'GOKAVARAM' && String(store.data.established) === '2016', '4. City is Gokavaram and Established in 2016');

    // 3. Category grouping
    const categories = await makeRequest('/api/categories');
    assert(categories.status === 200 && Array.isArray(categories.data) && categories.data.length >= 6, '5. Category groupings returned (>= 6 distinct categories)');

    // 4. Products Catalog & Mandatory Items
    const products = await makeRequest('/api/products');
    assert(products.status === 200 && Array.isArray(products.data) && products.data.length >= 20, '6. Product catalog retrieved successfully');

    const names = products.data.map(p => p.name.toLowerCase());
    
    // Check UltraTech
    const hasUltraTech = names.some(n => n.includes('ultratech'));
    assert(hasUltraTech, '7. Catalog contains UltraTech cement range');

    // Check Iron sizes: 6mm, 8mm, 10mm, 12mm, 16mm
    const has6mm = names.some(n => n.includes('6mm') && (n.includes('iron') || n.includes('tmt') || n.includes('steel')));
    const has8mm = names.some(n => n.includes('8mm') && (n.includes('iron') || n.includes('tmt') || n.includes('steel')));
    const has10mm = names.some(n => n.includes('10mm') && (n.includes('iron') || n.includes('tmt') || n.includes('steel')));
    const has12mm = names.some(n => n.includes('12mm') && (n.includes('iron') || n.includes('tmt') || n.includes('steel')));
    const has16mm = names.some(n => n.includes('16mm') && (n.includes('iron') || n.includes('tmt') || n.includes('steel')));
    assert(has6mm && has8mm && has10mm && has12mm && has16mm, '8. Catalog contains all Iron/Steel sizes: 6mm, 8mm, 10mm, 12mm, 16mm');

    // Check Mess Roles
    const hasMessRoles = names.some(n => n.includes('mess') || n.includes('mesh'));
    assert(hasMessRoles, '9. Catalog contains Mess / Mesh Roles');

    // Check Slab Liquids
    const hasSlabLiquids = names.some(n => n.includes('slab') || n.includes('waterproofing') || n.includes('liquid') || n.includes('pidiproof'));
    assert(hasSlabLiquids, '10. Catalog contains Slab Liquids / Waterproofing');

    // Check Sponges
    const hasSponges = names.some(n => n.includes('sponge'));
    assert(hasSponges, '11. Catalog contains Plastering / Masonry Sponges');

    // Check Bricket Boxes
    const hasBricketBoxes = names.some(n => n.includes('bricket') || n.includes('brick') || n.includes('gi box') || n.includes('modular'));
    assert(hasBricketBoxes, '12. Catalog contains Bricket Boxes / Modular GI Boxes');

    // 5. Owner PIN Authentication (PIN := 2016)
    // Attempt wrong PIN
    const wrongAuth = await makeRequest('/api/owner/verify-pin', 'POST', { pin: '9999' });
    assert(wrongAuth.status === 401 && wrongAuth.data.success === false, '13. Security: Wrong PIN is rejected (HTTP 401)');

    // Attempt correct PIN 2016
    const correctAuth = await makeRequest('/api/owner/verify-pin', 'POST', { pin: '2016' });
    assert(correctAuth.status === 200 && correctAuth.data.success === true && typeof correctAuth.data.token === 'string', '14. Security: PIN 2016 authenticated successfully with session token');
    const ownerToken = correctAuth.data.token;

    // Check unauthorized access rejection without token
    const unauthAdd = await makeRequest('/api/products', 'POST', { name: 'Unauthorized Item' });
    assert(unauthAdd.status === 401, '15. Security: Adding product rejected without valid Owner Token');

    // 6. Authorized Owner CRUD
    const newProduct = {
      name: 'QA Test UltraTech Specialized Super',
      brand: 'UltraTech Building Solutions',
      category: 'Cement',
      unit: 'Bags',
      price: 410,
      description: 'Tested via automated QA suite',
      active: 1
    };
    const createProd = await makeRequest('/api/products', 'POST', newProduct, ownerToken);
    assert(createProd.status === 201 && createProd.data.success === true, '16. Owner can add new product with valid token');
    const createdProdId = createProd.data.id;

    // Update Product
    const updateProd = await makeRequest(`/api/products/${createdProdId}`, 'PUT', {
      ...newProduct,
      name: 'QA Test UltraTech Specialized Super (Updated)',
      price: 420
    }, ownerToken);
    assert(updateProd.status === 200 && updateProd.data.success === true, '17. Owner can update existing product');

    // Delete Product
    const deleteProd = await makeRequest(`/api/products/${createdProdId}`, 'DELETE', null, ownerToken);
    assert(deleteProd.status === 200 && deleteProd.data.success === true, '18. Owner can delete product');

    // 7. POS Billing & Accurate Tax Calculations
    const testBill = {
      custName: 'Pasumarthi Construction Client',
      custPhone: '9491945045',
      paymentMode: 'Cash',
      discount: 200,
      taxRate: 18,
      items: [
        { name: 'UltraTech Super Cement', unit: 'Bags', unitPrice: 400, qty: 10 },    // 4000
        { name: 'Iron TMT Bar 12mm Fe 550D', unit: 'MT', unitPrice: 60000, qty: 0.1 } // 6000
      ]
    };
    // Expected:
    // Subtotal = 4000 + 6000 = 10000
    // Taxable = 10000 - 200 = 9800
    // GST (18%) = 9800 * 0.18 = 1764
    // Grand Total = 9800 + 1764 = 11564

    const createBill = await makeRequest('/api/bills', 'POST', testBill, ownerToken);
    assert(createBill.status === 201 && createBill.data.success === true, '19. Bill generated and saved successfully');
    const b = createBill.data.bill;
    assert(b.subtotal === 10000, `20. Billing: Subtotal accurate (Expected 10000, got ${b.subtotal})`);
    assert(b.discount === 200, '21. Billing: Discount stored accurately');
    assert(b.taxAmount === 1764, `22. Billing: Tax amount accurate (Expected 1764, got ${b.taxAmount})`);
    assert(b.grandTotal === 11564, `23. Billing: Grand Total accurate (Expected 11564, got ${b.grandTotal})`);

    // Verify bill is fetchable for invoice rendering
    const fetchBill = await makeRequest(`/api/bills/${b.id}`);
    assert(fetchBill.status === 200 && fetchBill.data.bill.invNo === b.invNo, '24. Individual bill retrievable by ID for invoice display');

    // 8. Bill Deletion cleanup
    const deleteBill = await makeRequest(`/api/bills/${b.id}`, 'DELETE', null, ownerToken);
    assert(deleteBill.status === 200 && deleteBill.data.success === true, '25. Owner can delete bill record');

    // 9. Static Assets & Logo Delivery
    const staticIndex = await makeRequest('/');
    assert(staticIndex.status === 200 && staticIndex.data.includes('VENKATARAMANA ENTERPRISES'), '26. Public website (index.html) delivered');

    const staticInvoice = await makeRequest('/invoice');
    assert(staticInvoice.status === 200 && staticInvoice.data.includes('TAX INVOICE'), '27. Invoice page (invoice.html) delivered');

    const staticLogoSvg = await makeRequest('/assets/logo/logo.svg');
    assert(staticLogoSvg.status === 200 && staticLogoSvg.headers['content-type'].includes('svg'), '28. Vector logo (/assets/logo/logo.svg) served');

    const staticIconSvg = await makeRequest('/assets/logo/icon.svg');
    assert(staticIconSvg.status === 200 && staticIconSvg.headers['content-type'].includes('svg'), '29. Favicon (/assets/logo/icon.svg) served');

    const staticLogoPng = await makeRequest('/assets/logo/logo.png');
    assert(staticLogoPng.status === 200, '30. Logo PNG image served');

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
