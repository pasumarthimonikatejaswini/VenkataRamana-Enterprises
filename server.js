/**
 * VENKATARAMANA ENTERPRISES - Full-Stack Backend Server
 * Iron & Cements Construction Materials & Owner POS System
 * Gokavaram, Andhra Pradesh
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const idx = line.indexOf('=');
      const key = line.substring(0, idx).trim();
      const val = line.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
const DEFAULT_OWNER_PIN = process.env.OWNER_PIN || '1234';

// Ensure data directory exists for local SQLite fallback
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// -------------------------------------------------------------
// Central Store Business Configuration
// -------------------------------------------------------------
const STORE_INFO = {
  name: 'VENKATARAMANA ENTERPRISES',
  tagline: 'ONE STOP SOLUTION FOR BUILDING SOLUTION',
  established: 2016,
  businessType: 'IRON AND CEMENTS',
  primaryOwner: 'PASUMARTHI MARIDIRAJU',
  coOwner: 'PASUMARTHI SATYAKALA',
  phone: '9849145045',
  whatsapp: '9491945045',
  email: 'pasumarthisatyakala@gmail.com',
  address: 'D.no: 10-27, opposite police station, Main Road, Gokavaram, East Godavari District, PIN CODE: 533286',
  city: 'GOKAVARAM',
  state: 'ANDHRA PRADESH',
  pincode: '533286',
  maps: 'https://maps.app.goo.gl/XzdagTc6YNRoW4Yc7',
  openingTime: '6:00 AM',
  closingTime: '7:30 PM',
  weeklyHoliday: 'None / Open throughout the week',
  currency: '₹',
  languages: ['English', 'Telugu']
};

// -------------------------------------------------------------
// Database Adapter (Turso Cloud LibSQL or Local SQLite Sync)
// -------------------------------------------------------------
let dbClient = null;
let isTurso = Boolean(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN);

function initDatabase() {
  if (isTurso) {
    console.log('[DB] Connecting to Turso Cloud LibSQL:', TURSO_DATABASE_URL);
    // Turso HTTP Client
    dbClient = {
      type: 'turso',
      async execute(sql, params = []) {
        const url = TURSO_DATABASE_URL.replace('libsql://', 'https://') + '/v2/pipeline';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TURSO_AUTH_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                type: 'execute',
                stmt: {
                  sql,
                  args: params.map(p => {
                    if (p === null || p === undefined) return { type: 'null' };
                    if (typeof p === 'number') {
                      return Number.isInteger(p)
                        ? { type: 'integer', value: String(p) }
                        : { type: 'float', value: p };
                    }
                    if (typeof p === 'boolean') {
                      return { type: 'integer', value: p ? '1' : '0' };
                    }
                    return { type: 'text', value: String(p) };
                  })
                }
              }
            ]
          })
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Turso HTTP Error (${res.status}): ${errText}`);
        }
        const data = await res.json();
        const first = data.results && data.results[0];
        if (first && first.type === 'error') {
          throw new Error(`Turso SQL Error: ${first.error?.message || 'Unknown error'}`);
        }
        const result = first?.response?.result;
        if (!result) return { rows: [], rowsAffected: 0 };
        const cols = (result.cols || []).map(c => c.name);
        const rows = (result.rows || []).map(row => {
          const obj = {};
          row.forEach((val, i) => {
            if (!val || val.type === 'null' || val.value === undefined) {
              obj[cols[i]] = null;
            } else if (val.type === 'integer' || val.type === 'float') {
              obj[cols[i]] = Number(val.value);
            } else {
              obj[cols[i]] = val.value;
            }
          });
          return obj;
        });
        return { rows, rowsAffected: result.affected_row_count || 0 };
      }
    };
  } else {
    console.log('[DB] Using local SQLite database:', path.join(dataDir, 'local.db'));
    const { DatabaseSync } = require('node:sqlite');
    const localDb = new DatabaseSync(path.join(dataDir, 'local.db'));
    dbClient = {
      type: 'local-sqlite',
      async execute(sql, params = []) {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
          const stmt = localDb.prepare(sql);
          const rows = stmt.all(...params);
          return { rows, rowsAffected: 0 };
        } else {
          const stmt = localDb.prepare(sql);
          const info = stmt.run(...params);
          return { rows: [], rowsAffected: info.changes || 0 };
        }
      },
      execBatch(script) {
        localDb.exec(script);
      }
    };
  }
}

async function runQuery(sql, params = []) {
  return await dbClient.execute(sql, params);
}

// -------------------------------------------------------------
// Database Migrations & Initial Seed Data
// -------------------------------------------------------------
async function migrateDatabase() {
  console.log('[DB] Running database migrations...');

  const tables = [
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT,
      description TEXT,
      unit TEXT,
      price REAL,
      originalPrice REAL,
      stock REAL,
      image TEXT,
      active INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      logo TEXT,
      active INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      invNo TEXT UNIQUE NOT NULL,
      invDate TEXT NOT NULL,
      custName TEXT,
      custPhone TEXT,
      paymentMode TEXT,
      subtotal REAL,
      discount REAL,
      taxRate REAL,
      taxAmount REAL,
      grandTotal REAL,
      itemsJson TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS owner_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pin TEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT,
      language TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );`
  ];

  for (const sql of tables) {
    await runQuery(sql);
  }

  // Seed Owner PIN
  const authRes = await runQuery('SELECT * FROM owner_auth WHERE id = 1');
  if (authRes.rows.length === 0) {
    await runQuery('INSERT INTO owner_auth (id, pin) VALUES (1, ?)', [DEFAULT_OWNER_PIN]);
  }

  // Seed Categories
  const catRes = await runQuery('SELECT COUNT(*) as count FROM categories');
  const catCount = Number(catRes.rows[0].count || 0);
  if (catCount === 0) {
    console.log('[DB] Seeding initial construction material categories...');
    const categories = [
      { id: 'cat-cement', name: 'Cement', description: 'OPC, PPC, Composite, Premium and Specialty cements' },
      { id: 'cat-steel', name: 'Steel & TMT', description: 'High-strength TMT rebars, Fe500D, Fe550D, Fe600 and structural steel' },
      { id: 'cat-bricks', name: 'Bricks & Blocks', description: 'Fly ash bricks, concrete blocks, masonry blocks and AAC blocks' },
      { id: 'cat-binding', name: 'Binding & Reinforcement', description: 'Binding wire, stirrups, cut & bend rebars and welded wire mesh' },
      { id: 'cat-chemicals', name: 'Construction Chemicals', description: 'Waterproofing, tile adhesives, epoxy grouts and repair products' },
      { id: 'cat-plaster', name: 'Plaster & Finishing', description: 'Ready-mix plaster, wall putty, white cement and surface finishing' },
      { id: 'cat-aggregates', name: 'Aggregates & Basic Materials', description: 'River sand, stone aggregates, gravel and foundational materials' },
      { id: 'cat-plumbing', name: 'Plumbing & Pipes', description: 'Water supply pipes, drainage pipes and heavy-duty fittings' },
      { id: 'cat-roofing', name: 'Roofing', description: 'Corrugated roofing sheets, accessories and weather protection' },
      { id: 'cat-other', name: 'Other Construction Materials', description: 'General building site essentials and hardware accessories' }
    ];
    for (const c of categories) {
      await runQuery('INSERT INTO categories (id, name, description, active) VALUES (?, ?, ?, 1)', [c.id, c.name, c.description]);
    }
  }

  // Seed Confirmed Brands
  const brandRes = await runQuery('SELECT COUNT(*) as count FROM brands');
  const brandCount = Number(brandRes.rows[0].count || 0);
  if (brandCount === 0) {
    console.log('[DB] Seeding confirmed brands (UltraTech, Jindal Panther, Vizag Steel, Mangal TMT)...');
    const brands = [
      {
        id: 'brand-ultratech',
        name: 'UltraTech Building Solutions',
        description: 'Comprehensive home-building solutions including cement, waterproofing, tile adhesives, grouts, repair products and AAC blocks.',
        logo: '/assets/brands/ultratech.svg'
      },
      {
        id: 'brand-jindal-panther',
        name: 'Jindal Panther',
        description: 'Premium TMT rebars (Fe500D, Fe550D, Fe600, CRS), binding wire, stirrups and cut & bend reinforcement.',
        logo: '/assets/brands/jindal-panther.svg'
      },
      {
        id: 'brand-vizag-steel',
        name: 'Vizag Steel',
        description: 'RINL high-grade structural steel and TMT rebars manufactured with pure steel quality.',
        logo: '/assets/brands/vizag-steel.svg'
      },
      {
        id: 'brand-mangal-tmt',
        name: 'Mangal TMT',
        description: 'High-ductility earthquake-resistant TMT rebars, billets and masonry fly ash bricks.',
        logo: '/assets/brands/mangal-tmt.svg'
      }
    ];
    for (const b of brands) {
      await runQuery('INSERT INTO brands (id, name, description, logo, active) VALUES (?, ?, ?, ?, 1)', [b.id, b.name, b.description, b.logo]);
    }
  }

  // Seed 50+ Real Construction Materials Catalog Items
  const prodRes = await runQuery('SELECT COUNT(*) as count FROM products');
  const prodCount = Number(prodRes.rows[0].count || 0);
  if (prodCount === 0) {
    console.log('[DB] Seeding initial 50+ construction product catalog items (No fake prices)...');
    const seedProducts = [
      // 1-8 Cement
      { id: 'p-cem-01', name: 'UltraTech PPC Cement (Portland Pozzolana)', brand: 'UltraTech Building Solutions', category: 'Cement', unit: 'Bags (50 kg)', desc: 'High durability fly-ash blended cement for brickwork, plastering and general concrete.' },
      { id: 'p-cem-02', name: 'UltraTech Super Cement', brand: 'UltraTech Building Solutions', category: 'Cement', unit: 'Bags (50 kg)', desc: 'Engineered composite cement with micro-fine particles providing denser concrete.' },
      { id: 'p-cem-03', name: 'UltraTech Weather Pro Cement', brand: 'UltraTech Building Solutions', category: 'Cement', unit: 'Bags (50 kg)', desc: 'Water-repellent active cement specially formulated to resist dampness and efflorescence.' },
      { id: 'p-cem-04', name: 'Ordinary Portland Cement (OPC 53 Grade)', brand: 'UltraTech Building Solutions', category: 'Cement', unit: 'Bags (50 kg)', desc: 'High initial and ultimate strength cement for fast-setting RCC slabs, columns and beams.' },
      { id: 'p-cem-05', name: 'Ordinary Portland Cement (OPC 43 Grade)', brand: 'UltraTech Building Solutions', category: 'Cement', unit: 'Bags (50 kg)', desc: 'Standard structural cement suitable for residential plastering, flooring and pre-cast units.' },
      { id: 'p-cem-06', name: 'Portland Slag Cement (PSC)', brand: 'Vizag Steel', category: 'Cement', unit: 'Bags (50 kg)', desc: 'Blast furnace slag blended cement offering superior sulphate resistance and crack prevention.' },
      { id: 'p-cem-07', name: 'UltraTech White Topping Cement', brand: 'UltraTech Building Solutions', category: 'Cement', unit: 'Bags (50 kg)', desc: 'Specialty white cement for architectural finishes, terrazzo and decorative concrete.' },
      { id: 'p-cem-08', name: 'Rapid Hardening Cement', brand: 'UltraTech Building Solutions', category: 'Cement', unit: 'Bags (50 kg)', desc: 'High early strength cement designed for rapid formwork removal and urgent structural repairs.' },

      // 9-16 Steel & TMT
      { id: 'p-stl-01', name: 'Jindal Panther TMT 550D Rebars (8mm)', brand: 'Jindal Panther', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'Superior bendability and seismic resistance Fe550D grade steel for slab reinforcement.' },
      { id: 'p-stl-02', name: 'Jindal Panther TMT 550D Rebars (10mm)', brand: 'Jindal Panther', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'High ductile TMT rebar for structural residential and commercial columns and beams.' },
      { id: 'p-stl-03', name: 'Jindal Panther TMT 550D Rebars (12mm)', brand: 'Jindal Panther', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'Heavy load-bearing TMT steel bars with uniform rib pattern for maximum concrete bonding.' },
      { id: 'p-stl-04', name: 'Jindal Panther TMT 550D Rebars (16mm)', brand: 'Jindal Panther', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'Primary reinforcement steel for high-rise columns, foundation footings and raft slabs.' },
      { id: 'p-stl-05', name: 'Vizag Steel TMT Fe500D (10mm)', brand: 'Vizag Steel', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'Pure steel primary product from RINL with low sulphur and phosphorus for high longevity.' },
      { id: 'p-stl-06', name: 'Vizag Steel TMT Fe500D (12mm)', brand: 'Vizag Steel', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'Certified Fe500D steel bar engineered for superior corrosion resistance and weldability.' },
      { id: 'p-stl-07', name: 'Mangal TMT 550D High Ductility Rebars (10mm)', brand: 'Mangal TMT', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'Thermo-mechanically treated rebars offering balanced yield strength and elongation.' },
      { id: 'p-stl-08', name: 'Mangal TMT 550D High Ductility Rebars (12mm)', brand: 'Mangal TMT', category: 'Steel & TMT', unit: 'Metric Ton / Bundle', desc: 'Seismic resistant steel bars with German quenching technology for reinforced concrete.' },

      // 17-21 Bricks & Blocks
      { id: 'p-brk-01', name: 'High-Density Fly Ash Bricks', brand: 'Mangal TMT', category: 'Bricks & Blocks', unit: '1000 Pieces', desc: 'Uniform machine-pressed fly ash bricks with sharp edges, reducing mortar consumption.' },
      { id: 'p-brk-02', name: 'Standard Red Clay Bricks', brand: 'VENKATARAMANA ENTERPRISES', category: 'Bricks & Blocks', unit: '1000 Pieces', desc: 'Kiln-burnt quality clay bricks for external and load-bearing masonry walls.' },
      { id: 'p-brk-03', name: 'Solid Concrete Blocks (4 Inch)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Bricks & Blocks', unit: 'Pieces', desc: 'High compressive strength solid concrete partition blocks for partition walls.' },
      { id: 'p-brk-04', name: 'Solid Concrete Blocks (6 Inch)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Bricks & Blocks', unit: 'Pieces', desc: 'Heavy-duty solid blocks for perimeter compound walls and structural partitions.' },
      { id: 'p-brk-05', name: 'UltraTech Autoclaved Aerated Concrete (AAC) Blocks', brand: 'UltraTech Building Solutions', category: 'Bricks & Blocks', unit: 'Cubic Metre / Block', desc: 'Lightweight, thermal-insulating building blocks that reduce building dead-load significantly.' },

      // 22-26 Binding & Reinforcement
      { id: 'p-bnd-01', name: 'Annealed GI Binding Wire (18 Gauge)', brand: 'Jindal Panther', category: 'Binding & Reinforcement', unit: 'Roll (25 kg)', desc: 'Soft and ductile galvanized iron binding wire for secure rebar tying without snapping.' },
      { id: 'p-bnd-02', name: 'Annealed MS Binding Wire (20 Gauge)', brand: 'Jindal Panther', category: 'Binding & Reinforcement', unit: 'Roll (25 kg)', desc: 'Flexible mild steel binding wire for intricate stirrup and column tie fixations.' },
      { id: 'p-bnd-03', name: 'Ready-Made TMT Stirrups / Rings (7x7 inch)', brand: 'Jindal Panther', category: 'Binding & Reinforcement', unit: 'Bundle (50 pcs)', desc: 'Precision machine-bent steel stirrups with standard 135-degree seismic hooks.' },
      { id: 'p-bnd-04', name: 'Ready-Made TMT Stirrups / Rings (7x9 inch)', brand: 'Jindal Panther', category: 'Binding & Reinforcement', unit: 'Bundle (50 pcs)', desc: 'Factory-finished beam rings ensuring exact spacing and column alignment on site.' },
      { id: 'p-bnd-05', name: 'Welded Wire Mesh Reinforcement', brand: 'Jindal Panther', category: 'Binding & Reinforcement', unit: 'Roll / Sheet', desc: 'Prefabricated steel grid for flooring concrete reinforcement and crack mitigation.' },

      // 27-33 Construction Chemicals
      { id: 'p-chm-01', name: 'UltraTech Seal & Dry Waterproofing Coating', brand: 'UltraTech Building Solutions', category: 'Construction Chemicals', unit: 'Bucket (20 Litre)', desc: 'Acrylic polymer waterproofing system for roofs, terraces, bathrooms and water tanks.' },
      { id: 'p-chm-02', name: 'UltraTech Tilefixo Standard Tile Adhesive', brand: 'UltraTech Building Solutions', category: 'Construction Chemicals', unit: 'Bag (20 kg)', desc: 'Polymer-modified cementitious tile adhesive for ceramic and vitrified floor tiles.' },
      { id: 'p-chm-03', name: 'UltraTech Tilefixo High Strength Adhesive', brand: 'UltraTech Building Solutions', category: 'Construction Chemicals', unit: 'Bag (20 kg)', desc: 'Superior tensile adhesion adhesive for large vitrified tiles, granite and vertical walls.' },
      { id: 'p-chm-04', name: 'UltraTech Powergrout Tile Grout', brand: 'UltraTech Building Solutions', category: 'Construction Chemicals', unit: 'Pack (1 kg)', desc: 'Water-resistant cementitious tile joint filler available in matching shades.' },
      { id: 'p-chm-05', name: 'UltraTech Epoxy Grout 3-Part System', brand: 'UltraTech Building Solutions', category: 'Construction Chemicals', unit: 'Kit (5 kg)', desc: 'Chemical, stain and waterproof epoxy tile grout for kitchen counters and wet areas.' },
      { id: 'p-chm-06', name: 'UltraTech Microcrete Structural Repair Mortar', brand: 'UltraTech Building Solutions', category: 'Construction Chemicals', unit: 'Bag (25 kg)', desc: 'Non-shrink high-strength flowable micro-concrete for column repair and jacketing.' },
      { id: 'p-chm-07', name: 'Integral Waterproofing Liquid Compound', brand: 'UltraTech Building Solutions', category: 'Construction Chemicals', unit: 'Can (5 Litre)', desc: 'Liquid waterproofing admixture for concrete and mortar during casting and plastering.' },

      // 34-39 Plaster & Finishing
      { id: 'p-pls-01', name: 'UltraTech Readplast Ready-Mix Plaster', brand: 'UltraTech Building Solutions', category: 'Plaster & Finishing', unit: 'Bag (40 kg)', desc: 'Premixed cement-graded sand plaster offering crack-free and silky-smooth wall finish.' },
      { id: 'p-pls-02', name: 'UltraTech Super Stucco Plaster Finish', brand: 'UltraTech Building Solutions', category: 'Plaster & Finishing', unit: 'Bag (40 kg)', desc: 'Decorative external plaster with water-resistant surface and high weather durability.' },
      { id: 'p-pls-03', name: 'UltraTech Wall Putty (Polymer Based)', brand: 'UltraTech Building Solutions', category: 'Plaster & Finishing', unit: 'Bag (40 kg)', desc: 'White cement based putty providing brilliant white, pinhole-free base for wall paint.' },
      { id: 'p-pls-04', name: 'Birla White WallSeal Waterproof Putty', brand: 'UltraTech Building Solutions', category: 'Plaster & Finishing', unit: 'Bag (30 kg)', desc: 'Active silicone enriched wall putty that safeguards interior walls against paint peel-off.' },
      { id: 'p-pls-05', name: 'White Cement Grade A', brand: 'UltraTech Building Solutions', category: 'Plaster & Finishing', unit: 'Bag (25 kg)', desc: 'Ultra-pure white cement for priming, terrazzo design, and artistic plaster textures.' },
      { id: 'p-pls-06', name: 'Gypsum Wall Plaster (One Coat)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Plaster & Finishing', unit: 'Bag (25 kg)', desc: 'Direct-to-brick lightweight interior gypsum plaster eliminating sand curing time.' },

      // 40-44 Aggregates & Basic Materials
      { id: 'p-agg-01', name: 'Godavari River Sand (Washed & Screened)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Aggregates & Basic Materials', unit: 'Tractor / Brass (100 cft)', desc: 'Natural river sand ideal for structural concreting, brick masonry and fine plaster work.' },
      { id: 'p-agg-02', name: 'Blue Metal Granite Aggregate (20mm)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Aggregates & Basic Materials', unit: 'Brass (100 cft)', desc: 'Angular crushed hard stone aggregate for standard RCC slabs, beams and foundation footings.' },
      { id: 'p-agg-03', name: 'Blue Metal Granite Aggregate (12mm / 10mm)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Aggregates & Basic Materials', unit: 'Brass (100 cft)', desc: 'Graded stone chips for thin concrete sections, column casting and flooring base concrete.' },
      { id: 'p-agg-04', name: 'Granite Stone Dust / M-Sand (Manufactured Sand)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Aggregates & Basic Materials', unit: 'Brass (100 cft)', desc: 'Eco-friendly cubical manufactured sand with controlled silt content for RCC structures.' },
      { id: 'p-agg-05', name: 'Rubble Foundation Stone', brand: 'VENKATARAMANA ENTERPRISES', category: 'Aggregates & Basic Materials', unit: 'Trip / Load', desc: 'Heavy quarry stone for basement basement foundations and compound retaining walls.' },

      // 45-48 Plumbing & Pipes
      { id: 'p-plm-01', name: 'CPVC Hot & Cold Water Pipes (1 Inch SDR 11)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Plumbing & Pipes', unit: 'Piece (3 Metre)', desc: 'Chlorinated polyvinyl chloride pipe resistant to scaling, corrosion and high water temperatures.' },
      { id: 'p-plm-02', name: 'UPVC Pressure Plumbing Pipes (1.5 Inch)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Plumbing & Pipes', unit: 'Piece (6 Metre)', desc: 'Lead-free unplasticized PVC pipes for potable water distribution and pump connections.' },
      { id: 'p-plm-03', name: 'SWR Drainage & Sewage Pipes (4 Inch)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Plumbing & Pipes', unit: 'Piece (3 Metre)', desc: 'Rubber ring jointed soil, waste and rainwater drainage pipes with UV protection.' },
      { id: 'p-plm-04', name: 'Heavy-Duty PVC Fittings Assortment (Elbows, Tees, Couplers)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Plumbing & Pipes', unit: 'Set', desc: 'Precision moulded leakage-proof fittings for residential and commercial plumbing lines.' },

      // 49-52 Roofing & Construction Essentials
      { id: 'p-rof-01', name: 'Colour Coated Trapezoidal Roofing Sheets', brand: 'VENKATARAMANA ENTERPRISES', category: 'Roofing', unit: 'Sq. Ft / Piece', desc: 'Pre-painted galvalume corrugated roofing sheets for industrial sheds and residential terraces.' },
      { id: 'p-rof-02', name: 'GI Corrugated Roofing Sheets (0.45mm)', brand: 'VENKATARAMANA ENTERPRISES', category: 'Roofing', unit: 'Piece', desc: 'Galvanized iron weather-resistant corrugated sheets for durable, long-life overhead roofing.' },
      { id: 'p-rof-03', name: 'Cement Fiber Corrugated Roofing Sheets', brand: 'VENKATARAMANA ENTERPRISES', category: 'Roofing', unit: 'Piece (3 Metre)', desc: 'Non-combustible, sound-dampening fibre cement sheets for cooling and weather protection.' },
      { id: 'p-rof-04', name: 'Self-Drilling Roofing Screws with EPDM Washers', brand: 'VENKATARAMANA ENTERPRISES', category: 'Roofing', unit: 'Box (100 pcs)', desc: 'Hexagonal carbon steel self-tapping fasteners with weatherproof rubber washers.' },
      { id: 'p-oth-01', name: 'High-Tensile Barbed Wire for Fencing', brand: 'VENKATARAMANA ENTERPRISES', category: 'Other Construction Materials', unit: 'Bundle (25 kg)', desc: 'Heavy galvanized 2-ply 4-point barbed wire for site perimeter boundary security.' },
      { id: 'p-oth-02', name: 'Heavy-Duty HDPE Tarpaulin Waterproof Sheet', brand: 'VENKATARAMANA ENTERPRISES', category: 'Other Construction Materials', unit: 'Piece (24x18 ft)', desc: 'Multi-layer laminated waterproof cover for protecting cement bags and steel rebars from rain.' }
    ];

    for (const p of seedProducts) {
      // Notice: price is null by default so it displays "Contact for Price", satisfying the strict NO FABRICATION rule
      await runQuery(
        `INSERT INTO products (id, name, brand, category, description, unit, price, originalPrice, stock, image, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [p.id, p.name, p.brand, p.category, p.desc, p.unit, null, null, null, '']
      );
    }
  }

  // Seed Default Settings
  const settings = [
    { key: 'gst_rate', value: process.env.GST_RATE || '' },
    { key: 'tagline', value: 'ONE STOP SOLUTION FOR BUILDING SOLUTION' },
    { key: 'payment_methods', value: JSON.stringify(['Cash', 'UPI', 'Card', 'Bank Transfer']) }
  ];
  for (const s of settings) {
    const existing = await runQuery('SELECT * FROM settings WHERE key = ?', [s.key]);
    if (existing.rows.length === 0) {
      await runQuery('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
  }

  console.log('[DB] Database migrations completed successfully.');
}

// -------------------------------------------------------------
// Token Management for Owner Authentication
// -------------------------------------------------------------
const activeTokens = new Set();

function generateAuthToken() {
  const token = 've_' + crypto.randomBytes(24).toString('hex');
  activeTokens.add(token);
  return token;
}

function verifyAuthToken(req) {
  // Login authentication removed per owner request - direct access enabled
  return true;
}

// -------------------------------------------------------------
// Request Helpers & Middleware
// -------------------------------------------------------------
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function serveStaticFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA
        const indexPath = path.join(__dirname, 'index.html');
        fs.readFile(indexPath, (indexErr, indexContent) => {
          if (indexErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

// -------------------------------------------------------------
// HTTP Request Dispatcher
// -------------------------------------------------------------
async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ---------------- API Routes ----------------
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health Check
      if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, {
          status: 'ok',
          business: STORE_INFO.name,
          dbType: dbClient.type,
          dbConnected: true,
          timestamp: new Date().toISOString()
        });
      }

      // 2. Store Info
      if (pathname === '/api/store-info' && req.method === 'GET') {
        const gstSetting = await runQuery('SELECT value FROM settings WHERE key = ?', ['gst_rate']);
        const taglineSetting = await runQuery('SELECT value FROM settings WHERE key = ?', ['tagline']);
        const paySetting = await runQuery('SELECT value FROM settings WHERE key = ?', ['payment_methods']);
        const pinRes = await runQuery('SELECT pin FROM owner_auth WHERE id = 1');

        let paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];
        try {
          if (paySetting.rows[0]?.value) {
            paymentMethods = JSON.parse(paySetting.rows[0].value);
          }
        } catch (e) {}

        const currentPin = pinRes.rows[0]?.pin || DEFAULT_OWNER_PIN;

        return sendJson(res, 200, {
          ...STORE_INFO,
          tagline: taglineSetting.rows[0]?.value || STORE_INFO.tagline,
          gstRate: gstSetting.rows[0]?.value || '',
          paymentMethods,
          isDefaultPin: currentPin === '1234'
        });
      }

      // 3. Owner Verification (Direct Open Access)
      if (pathname === '/api/owner/verify-pin') {
        const token = generateAuthToken();
        return sendJson(res, 200, {
          success: true,
          token,
          isDefaultPin: false,
          message: 'Direct access enabled without login authentication.'
        });
      }

      // 4. Products API
      if (pathname === '/api/products' && req.method === 'GET') {
        const category = parsedUrl.searchParams.get('category');
        const brand = parsedUrl.searchParams.get('brand');
        const search = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim();
        const sort = parsedUrl.searchParams.get('sort') || '';
        const isOwner = verifyAuthToken(req);

        let sql = 'SELECT * FROM products';
        const conditions = [];
        const params = [];

        if (!isOwner) {
          conditions.push('active = 1');
        }

        if (category && category !== 'All') {
          conditions.push('category = ?');
          params.push(category);
        }

        if (brand && brand !== 'All') {
          conditions.push('brand = ?');
          params.push(brand);
        }

        if (search) {
          conditions.push('(LOWER(name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)');
          const s = `%${search}%`;
          params.push(s, s, s, s);
        }

        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }

        if (sort === 'az') {
          sql += ' ORDER BY name ASC';
        } else if (sort === 'za') {
          sql += ' ORDER BY name DESC';
        } else if (sort === 'price_asc') {
          sql += ' ORDER BY CASE WHEN price IS NULL THEN 1 ELSE 0 END, price ASC';
        } else if (sort === 'price_desc') {
          sql += ' ORDER BY CASE WHEN price IS NULL THEN 1 ELSE 0 END, price DESC';
        } else {
          sql += ' ORDER BY category ASC, name ASC';
        }

        const resData = await runQuery(sql, params);
        return sendJson(res, 200, resData.rows);
      }

      if (pathname === '/api/products' && req.method === 'POST') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized. Owner authentication required.' });
        }
        const body = await parseBody(req);
        if (!body.name || !body.category) {
          return sendJson(res, 400, { error: 'Product name and category are required.' });
        }
        const id = 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        const name = String(body.name).trim();
        const brand = String(body.brand || 'VENKATARAMANA ENTERPRISES').trim();
        const category = String(body.category).trim();
        const description = String(body.description || '').trim();
        const unit = String(body.unit || 'Pieces').trim();
        const price = body.price !== '' && body.price !== null && !isNaN(Number(body.price)) ? Number(body.price) : null;
        const originalPrice = body.originalPrice !== '' && body.originalPrice !== null && !isNaN(Number(body.originalPrice)) ? Number(body.originalPrice) : null;
        const stock = body.stock !== '' && body.stock !== null && !isNaN(Number(body.stock)) ? Number(body.stock) : null;
        const image = String(body.image || '').trim();
        const active = body.active === 0 ? 0 : 1;

        await runQuery(
          `INSERT INTO products (id, name, brand, category, description, unit, price, originalPrice, stock, image, active, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [id, name, brand, category, description, unit, price, originalPrice, stock, image, active]
        );

        return sendJson(res, 201, { success: true, message: 'Product added successfully.', id });
      }

      if (pathname.startsWith('/api/products/') && req.method === 'PUT') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const id = pathname.replace('/api/products/', '');
        const body = await parseBody(req);

        const price = body.price !== '' && body.price !== null && !isNaN(Number(body.price)) ? Number(body.price) : null;
        const originalPrice = body.originalPrice !== '' && body.originalPrice !== null && !isNaN(Number(body.originalPrice)) ? Number(body.originalPrice) : null;
        const stock = body.stock !== '' && body.stock !== null && !isNaN(Number(body.stock)) ? Number(body.stock) : null;

        await runQuery(
          `UPDATE products SET name = ?, brand = ?, category = ?, description = ?, unit = ?, price = ?, originalPrice = ?, stock = ?, image = ?, active = ?, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            String(body.name || '').trim(),
            String(body.brand || '').trim(),
            String(body.category || '').trim(),
            String(body.description || '').trim(),
            String(body.unit || '').trim(),
            price,
            originalPrice,
            stock,
            String(body.image || '').trim(),
            body.active === 0 ? 0 : 1,
            id
          ]
        );
        return sendJson(res, 200, { success: true, message: 'Product updated successfully.' });
      }

      if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const id = pathname.replace('/api/products/', '');
        await runQuery('DELETE FROM products WHERE id = ?', [id]);
        return sendJson(res, 200, { success: true, message: 'Product deleted successfully.' });
      }

      // 5. Categories API
      if (pathname === '/api/categories' && req.method === 'GET') {
        const resData = await runQuery('SELECT * FROM categories ORDER BY name ASC');
        return sendJson(res, 200, resData.rows);
      }

      if (pathname === '/api/categories' && req.method === 'POST') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const body = await parseBody(req);
        if (!body.name) return sendJson(res, 400, { error: 'Category name is required.' });
        const id = body.id || 'cat-' + Date.now();
        await runQuery(
          'INSERT OR REPLACE INTO categories (id, name, description, active) VALUES (?, ?, ?, ?)',
          [id, String(body.name).trim(), String(body.description || '').trim(), body.active === 0 ? 0 : 1]
        );
        return sendJson(res, 200, { success: true, message: 'Category saved successfully.' });
      }

      // 6. Brands API
      if (pathname === '/api/brands' && req.method === 'GET') {
        const resData = await runQuery('SELECT * FROM brands ORDER BY name ASC');
        return sendJson(res, 200, resData.rows);
      }

      if (pathname === '/api/brands' && req.method === 'POST') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const body = await parseBody(req);
        if (!body.name) return sendJson(res, 400, { error: 'Brand name is required.' });
        const id = body.id || 'brand-' + Date.now();
        await runQuery(
          'INSERT OR REPLACE INTO brands (id, name, description, logo, active) VALUES (?, ?, ?, ?, ?)',
          [id, String(body.name).trim(), String(body.description || '').trim(), String(body.logo || '').trim(), body.active === 0 ? 0 : 1]
        );
        return sendJson(res, 200, { success: true, message: 'Brand saved successfully.' });
      }

      // 7. Bills / POS Billing API
      if (pathname === '/api/bills' && req.method === 'GET') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const billsRes = await runQuery('SELECT * FROM bills ORDER BY createdAt DESC');
        
        // Calculate Analytics dynamically
        let totalRevenue = 0;
        let totalBills = billsRes.rows.length;
        let todayRevenue = 0;
        let todayBills = 0;

        const todayStr = new Date().toISOString().slice(0, 10);

        const bills = billsRes.rows.map(b => {
          let items = [];
          try {
            items = JSON.parse(b.itemsJson || '[]');
          } catch (e) {}

          const grandTotal = Number(b.grandTotal || 0);
          totalRevenue += grandTotal;

          if (b.invDate === todayStr || (b.createdAt && b.createdAt.startsWith(todayStr))) {
            todayRevenue += grandTotal;
            todayBills++;
          }

          return {
            ...b,
            items
          };
        });

        return sendJson(res, 200, {
          analytics: {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalBills,
            todayRevenue: Math.round(todayRevenue * 100) / 100,
            todayBills
          },
          bills
        });
      }

      if (pathname.startsWith('/api/bills/') && req.method === 'GET') {
        const billId = pathname.replace('/api/bills/', '');
        const resBill = await runQuery('SELECT * FROM bills WHERE id = ? OR invNo = ?', [billId, billId]);
        if (!resBill.rows || resBill.rows.length === 0) {
          return sendJson(res, 404, { error: 'Invoice not found.' });
        }
        const b = resBill.rows[0];
        let items = [];
        try { items = JSON.parse(b.itemsJson || '[]'); } catch (e) {}
        return sendJson(res, 200, { bill: { ...b, items } });
      }

      if (pathname === '/api/bills' && req.method === 'POST') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const body = await parseBody(req);

        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
          return sendJson(res, 400, { error: 'Bill must contain at least one item. Please add an item before generating.' });
        }

        const id = 'bill-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        const dateObj = new Date();
        const ymd = dateObj.toISOString().slice(0, 10).replace(/-/g, '');
        let invNo = String(body.invNo || '').trim();
        if (!invNo || invNo === 'AUTO') {
          invNo = `VE-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Verify if invNo already exists in DB to prevent collision
        const existingInv = await runQuery('SELECT id FROM bills WHERE invNo = ?', [invNo]);
        if (existingInv.rows && existingInv.rows.length > 0) {
          invNo = `VE-${ymd}-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
        }

        const invDate = body.invDate || dateObj.toISOString().slice(0, 10);
        const custName = String(body.custName || 'Walk-in Customer').trim() || 'Walk-in Customer';
        const custPhone = String(body.custPhone || '').trim();
        const paymentMode = String(body.paymentMode || 'Cash').trim();

        // Calculate & verify line items
        let subtotal = 0;
        const verifiedItems = body.items.map(it => {
          const qty = Math.max(0.01, Number(it.qty || 1));
          const unitPrice = Math.max(0, Number(it.unitPrice || 0));
          const lineTotal = Math.round(qty * unitPrice * 100) / 100;
          subtotal += lineTotal;
          return {
            name: String(it.name || 'Material Item').trim(),
            unit: String(it.unit || 'Unit').trim(),
            qty,
            unitPrice,
            lineTotal
          };
        });

        subtotal = Math.round(subtotal * 100) / 100;
        const discount = Math.max(0, Number(body.discount || 0));
        const taxableAmount = Math.max(0, subtotal - discount);

        const taxRate = Number(body.taxRate || 0);
        const taxAmount = Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;
        const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

        await runQuery(
          `INSERT OR REPLACE INTO bills (id, invNo, invDate, custName, custPhone, paymentMode, subtotal, discount, taxRate, taxAmount, grandTotal, itemsJson)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, invNo, invDate, custName, custPhone, paymentMode, subtotal, discount, taxRate, taxAmount, grandTotal, JSON.stringify(verifiedItems)]
        );

        return sendJson(res, 201, {
          success: true,
          message: 'Bill generated successfully.',
          bill: {
            id,
            invNo,
            invDate,
            custName,
            custPhone,
            paymentMode,
            subtotal,
            discount,
            taxRate,
            taxAmount,
            grandTotal,
            items: verifiedItems
          }
        });
      }

      if (pathname.startsWith('/api/bills/') && req.method === 'DELETE') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const id = pathname.replace('/api/bills/', '');
        await runQuery('DELETE FROM bills WHERE id = ?', [id]);
        return sendJson(res, 200, { success: true, message: 'Bill deleted successfully.' });
      }

      // 8. Settings API
      if (pathname === '/api/settings' && req.method === 'GET') {
        const rows = (await runQuery('SELECT * FROM settings')).rows;
        const config = {};
        rows.forEach(r => { config[r.key] = r.value; });
        return sendJson(res, 200, config);
      }

      if (pathname === '/api/settings' && req.method === 'POST') {
        if (!verifyAuthToken(req)) {
          return sendJson(res, 401, { error: 'Unauthorized.' });
        }
        const body = await parseBody(req);

        // Update GST Rate if provided
        if (body.gst_rate !== undefined) {
          const gstVal = String(body.gst_rate).trim();
          await runQuery('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['gst_rate', gstVal]);
        }

        // Update Tagline if provided
        if (body.tagline !== undefined) {
          const tagVal = String(body.tagline).trim();
          await runQuery('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tagline', tagVal]);
        }

        // Update Payment Methods if provided
        if (body.payment_methods !== undefined) {
          const payVal = Array.isArray(body.payment_methods) ? JSON.stringify(body.payment_methods) : String(body.payment_methods);
          await runQuery('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['payment_methods', payVal]);
        }

        // Update Owner PIN if provided
        if (body.new_pin && String(body.new_pin).trim().length >= 4) {
          const newPin = String(body.new_pin).trim();
          await runQuery('UPDATE owner_auth SET pin = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = 1', [newPin]);
        }

        return sendJson(res, 200, { success: true, message: 'Settings updated successfully.' });
      }

      // 9. Contact / Inquiries API (for future expansion)
      if (pathname === '/api/contact' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.phone) {
          return sendJson(res, 400, { error: 'Name and phone are required.' });
        }
        await runQuery(
          'INSERT INTO inquiries (name, phone, message, language) VALUES (?, ?, ?, ?)',
          [String(body.name).trim(), String(body.phone).trim(), String(body.message || '').trim(), String(body.language || 'English').trim()]
        );
        return sendJson(res, 200, { success: true, message: 'Inquiry received.' });
      }

      return sendJson(res, 404, { error: 'API route not found' });
    } catch (err) {
      console.error('[API Error]:', err);
      return sendJson(res, 500, { error: 'Internal server error', details: err.message });
    }
  }

  // ---------------- Static Assets & SPA Handling ----------------
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  } else if (safePath === '/invoice' || safePath === '\\invoice') {
    safePath = '/invoice.html';
  }

  const localFilePath = path.join(__dirname, safePath);
  serveStaticFile(req, res, localFilePath);
}

// -------------------------------------------------------------
// Server Initialization
// -------------------------------------------------------------
async function startServer() {
  try {
    initDatabase();
    await migrateDatabase();

    const server = http.createServer((req, res) => {
      handleRequest(req, res);
    });

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  VENKATARAMANA ENTERPRISES - IRON AND CEMENTS`);
      console.log(`  "ONE STOP SOLUTION FOR BUILDING SOLUTION"`);
      console.log(`  Server running at: http://localhost:${PORT}`);
      console.log(`  Database Mode:     ${dbClient.type.toUpperCase()}`);
      console.log(`=======================================================`);
    });

    return server;
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
}

// Support Vercel serverless export
if (process.env.VERCEL) {
  let isReady = false;
  module.exports = async (req, res) => {
    if (!isReady) {
      initDatabase();
      await migrateDatabase();
      isReady = true;
    }
    await handleRequest(req, res);
  };
} else {
  startServer();
}
