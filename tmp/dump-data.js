const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  const institutions = await prisma.institution.findMany({ select: { id: true, name: true, domain: true } });
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } });
  const courses = await prisma.course.findMany({ select: { id: true, code: true, name: true, institutionId: true } });
  const classes = await prisma.class.findMany({ select: { id: true, name: true, courseId: true } });

  const teachers = users.filter((u) => u.role === 'TEACHER');
  const students = users.filter((u) => u.role === 'STUDENT');

  console.log(JSON.stringify({ institutions, teachers, students, courses, classes }, null, 2));

  await prisma.$disconnect();
  await pool.end();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
