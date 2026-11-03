const request = require('supertest');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { useSeededDatabase } = require('../test-utils/testDb');
const Material = require('../models/Material');
const { UPLOAD_DIR } = require('../middleware/upload');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

describe('CSQP-13: Study Material Upload & Search', () => {
  const db = useSeededDatabase();

  let studentAuth;
  const tempTestFiles = [];

  beforeEach(() => {
    if (db.seed && db.seed.users && db.seed.users.student) {
      const student = db.seed.users.student;
      const studentToken = jwt.sign(
        { id: student._id.toString(), email: student.email, role: student.role, name: student.name },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      studentAuth = `Bearer ${studentToken}`;
    }
  });

  afterAll(async () => {
    // Cleanup any created upload files in uploads directory
    for (const f of tempTestFiles) {
      try {
        await fs.promises.unlink(f);
      } catch {}
    }
  });

  it('rejects upload without authentication (401)', async () => {
    const res = await request(app)
      .post('/api/materials/upload')
      .attach('file', Buffer.from('%PDF-1.4 test'), 'sample.pdf')
      .field('title', 'OS Notes')
      .field('subject', 'Operating Systems');

    expect(res.status).toBe(401);
  });

  it('rejects upload when file field is missing (400 VALIDATION_ERROR)', async () => {
    const res = await request(app)
      .post('/api/materials/upload')
      .set('Authorization', studentAuth)
      .field('title', 'OS Notes')
      .field('subject', 'Operating Systems');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects upload when title or subject is missing (400 VALIDATION_ERROR)', async () => {
    const res = await request(app)
      .post('/api/materials/upload')
      .set('Authorization', studentAuth)
      .attach('file', Buffer.from('%PDF-1.4 dummy'), 'sample.pdf')
      .field('subject', 'Operating Systems');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid file types like .txt (400 INVALID_FILE_TYPE)', async () => {
    const res = await request(app)
      .post('/api/materials/upload')
      .set('Authorization', studentAuth)
      .attach('file', Buffer.from('plain text content'), 'notes.txt')
      .field('title', 'Text Notes')
      .field('subject', 'Operating Systems');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_FILE_TYPE');
  });

  it('successfully uploads valid PDF study material (201)', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const res = await request(app)
      .post('/api/materials/upload')
      .set('Authorization', studentAuth)
      .attach('file', pdfBuffer, 'os-summary.pdf')
      .field('title', 'Virtual Memory Summary')
      .field('subject', 'Operating Systems')
      .field('tags', 'os,memory,paging');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.material.title).toBe('Virtual Memory Summary');
    expect(res.body.material.subject).toBe('Operating Systems');
    expect(res.body.material.tags).toEqual(['os', 'memory', 'paging']);
    expect(res.body.material.versions).toHaveLength(1);
    expect(res.body.material.fileUrl).toMatch(/^\/api\/materials\/files\//);

    // Keep track for cleanup
    const filename = path.basename(res.body.material.fileUrl);
    tempTestFiles.push(path.join(UPLOAD_DIR, filename));

    // Verify file is stored on disk
    expect(fs.existsSync(path.join(UPLOAD_DIR, filename))).toBe(true);

    // Verify access to uploaded file requires authentication
    const unauthFileRes = await request(app).get(res.body.material.fileUrl);
    expect(unauthFileRes.status).toBe(401);

    const authFileRes = await request(app)
      .get(res.body.material.fileUrl)
      .set('Authorization', studentAuth);
    expect(authFileRes.status).toBe(200);
  });

  it('retrieves and searches materials list (200)', async () => {
    const listRes = await request(app)
      .get('/api/materials')
      .set('Authorization', studentAuth);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.materials)).toBe(true);

    // Filter by search query
    const searchRes = await request(app)
      .get('/api/materials?search=Memory')
      .set('Authorization', studentAuth);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.materials.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.materials[0].title).toContain('Memory');
  });

  it('retrieves a single material by ID (200)', async () => {
    const material = await Material.findOne({ title: 'Virtual Memory Summary' });
    expect(material).toBeTruthy();

    const res = await request(app)
      .get(`/api/materials/${material._id}`)
      .set('Authorization', studentAuth);

    expect(res.status).toBe(200);
    expect(res.body.material._id.toString()).toBe(material._id.toString());
  });

  it('returns 400 for invalid material ID format', async () => {
    const res = await request(app)
      .get('/api/materials/not-a-valid-id')
      .set('Authorization', studentAuth);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid material ID.');
  });
});
