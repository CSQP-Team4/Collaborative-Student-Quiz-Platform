const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const { useSeededDatabase } = require('../test-utils/testDb');
const Material = require('../models/Material');

const JWT_SECRET = process.env.JWT_SECRET || 'csqp_dev_jwt_secret_key_change_in_production_32b';

const authFor = (user) =>
  `Bearer ${jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  )}`;

describe('CSQP-26 / TC-Mat-03: ratings and comments on materials', () => {
  const db = useSeededDatabase();

  let studentAuth;
  let instructorAuth;
  let material; // uploaded by someone else, so both seeded users may rate it
  let ownMaterial; // uploaded by the student

  const rate = (auth, stars, id) =>
    request(app)
      .put(`/api/materials/${id || material._id}/rating`)
      .set('Authorization', auth)
      .send({ stars });

  beforeAll(async () => {
    const { student, instructor } = db.seed.users;
    studentAuth = authFor(student);
    instructorAuth = authFor(instructor);

    material = await Material.create({
      title: 'CSQP26 Rated Notes',
      subject: 'Testing',
      fileUrl: 'https://example.com/notes.pdf',
      uploadedBy: new mongoose.Types.ObjectId(),
    });

    ownMaterial = await Material.create({
      title: 'CSQP26 Student Own Notes',
      subject: 'Testing',
      fileUrl: 'https://example.com/own.pdf',
      uploadedBy: student._id,
    });
  });

  it('rejects unauthenticated rating (401)', async () => {
    const res = await request(app)
      .put(`/api/materials/${material._id}/rating`)
      .send({ stars: 4 });
    expect(res.status).toBe(401);
  });

  it('rating updates the average score (AC: real-time average)', async () => {
    const first = await rate(studentAuth, 4);
    expect(first.status).toBe(200);
    expect(first.body.ratingAverage).toBe(4);
    expect(first.body.ratingCount).toBe(1);

    const second = await rate(instructorAuth, 2);
    expect(second.status).toBe(200);
    expect(second.body.ratingAverage).toBe(3);
    expect(second.body.ratingCount).toBe(2);
  });

  it('changing a rating updates the average without adding a new rating', async () => {
    const res = await rate(studentAuth, 5);
    expect(res.status).toBe(200);
    expect(res.body.ratingCount).toBe(2);
    expect(res.body.ratingAverage).toBe(3.5);
    expect(res.body.myRating).toBe(5);
  });

  it('shows the stored average when the material is fetched', async () => {
    const res = await request(app)
      .get(`/api/materials/${material._id}`)
      .set('Authorization', studentAuth);
    expect(res.status).toBe(200);
    expect(res.body.material.ratingAverage).toBe(3.5);
    expect(res.body.material.ratingCount).toBe(2);
  });

  it('rejects invalid star values (400)', async () => {
    for (const bad of [0, 6, 3.5, '5', null]) {
      const res = await rate(studentAuth, bad);
      expect(res.status).toBe(400);
    }
  });

  it('returns 404 for an unknown or malformed material id', async () => {
    const unknown = await rate(studentAuth, 3, new mongoose.Types.ObjectId().toString());
    expect(unknown.status).toBe(404);
    const malformed = await rate(studentAuth, 3, 'not-an-id');
    expect(malformed.status).toBe(404);
  });

  it('does not let a student rate their own material (403)', async () => {
    const res = await rate(studentAuth, 5, ownMaterial._id);
    expect(res.status).toBe(403);
  });

  it('lets a student comment and lists the comment with the author', async () => {
    const post = await request(app)
      .post(`/api/materials/${material._id}/comments`)
      .set('Authorization', studentAuth)
      .send({ text: 'Very clear notes, thanks!' });
    expect(post.status).toBe(201);
    expect(post.body.comment.text).toBe('Very clear notes, thanks!');

    const list = await request(app)
      .get(`/api/materials/${material._id}/comments`)
      .set('Authorization', instructorAuth);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.comments[0].text).toBe('Very clear notes, thanks!');
    expect(list.body.comments[0].author).toBeTruthy();
  });

  it('rejects empty and too-long comments (400)', async () => {
    for (const text of ['', '   ', 'x'.repeat(1001)]) {
      const res = await request(app)
        .post(`/api/materials/${material._id}/comments`)
        .set('Authorization', studentAuth)
        .send({ text });
      expect(res.status).toBe(400);
    }
  });

  it('returns 404 when commenting on an unknown material', async () => {
    const res = await request(app)
      .post(`/api/materials/${new mongoose.Types.ObjectId()}/comments`)
      .set('Authorization', studentAuth)
      .send({ text: 'hello' });
    expect(res.status).toBe(404);
  });

  it('sort=rating lists the best-rated material first (best notes rise to top)', async () => {
    await Material.create({
      title: 'CSQP26 Low Rated',
      subject: 'Testing',
      fileUrl: 'https://example.com/low.pdf',
      uploadedBy: new mongoose.Types.ObjectId(),
      ratingAverage: 1,
      ratingCount: 3,
    });

    const res = await request(app)
      .get('/api/materials?search=CSQP26&sort=rating')
      .set('Authorization', studentAuth);
    expect(res.status).toBe(200);
    const titles = res.body.materials.map((m) => m.title);
    expect(titles.indexOf('CSQP26 Rated Notes')).toBeLessThan(
      titles.indexOf('CSQP26 Low Rated')
    );
  });
});
