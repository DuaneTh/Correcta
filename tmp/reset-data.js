const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PASSWORD = 'password123';

const createUsers = async (domain, institutionId, role, count) => {
  const users = [];
  for (let i = 1; i <= count; i += 1) {
    users.push({
      email: `${role.toLowerCase()}${i}@${domain}`,
      name: `${role === 'STUDENT' ? 'Student' : role === 'TEACHER' ? 'Teacher' : 'Admin'} ${i}`,
      role,
      institutionId,
    });
  }
  return users;
};

(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.$transaction([
    prisma.answerSegment.deleteMany(),
    prisma.answer.deleteMany(),
    prisma.grade.deleteMany(),
    prisma.proctorEvent.deleteMany(),
    prisma.gradingTask.deleteMany(),
    prisma.attempt.deleteMany(),
    prisma.examChange.deleteMany(),
    prisma.rubric.deleteMany(),
    prisma.questionSegment.deleteMany(),
    prisma.question.deleteMany(),
    prisma.examSection.deleteMany(),
    prisma.exam.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.class.deleteMany(),
    prisma.course.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.lMSConfig.deleteMany(),
    prisma.institutionDomain.deleteMany(),
    prisma.user.deleteMany(),
    prisma.institution.deleteMany(),
  ]);

  const demo1 = await prisma.institution.create({
    data: {
      name: 'Demo University 1',
      domain: 'demo1.edu',
    },
  });
  const demo2 = await prisma.institution.create({
    data: {
      name: 'Demo University 2',
      domain: 'demo2.edu',
    },
  });

  await prisma.institutionDomain.createMany({
    data: [
      { domain: 'demo1.edu', institutionId: demo1.id },
      { domain: 'demo2.edu', institutionId: demo2.id },
    ],
  });

  const users = [];
  users.push({
    email: 'admin@correcta.app',
    name: 'Platform Admin',
    role: 'PLATFORM_ADMIN',
    institutionId: null,
  });

  users.push({
    email: 'admin@demo1.edu',
    name: 'School Admin 1',
    role: 'SCHOOL_ADMIN',
    institutionId: demo1.id,
  });

  users.push({
    email: 'admin@demo2.edu',
    name: 'School Admin 2',
    role: 'SCHOOL_ADMIN',
    institutionId: demo2.id,
  });

  users.push(...await createUsers('demo1.edu', demo1.id, 'STUDENT', 10));
  users.push(...await createUsers('demo2.edu', demo2.id, 'STUDENT', 10));
  users.push(...await createUsers('demo1.edu', demo1.id, 'TEACHER', 5));
  users.push(...await createUsers('demo2.edu', demo2.id, 'TEACHER', 5));

  await prisma.user.createMany({
    data: users.map((user) => ({
      ...user,
      passwordHash,
    })),
  });

  console.log('Reset complete.');
  console.log('Institutions:', demo1.id, demo2.id);

  await prisma.$disconnect();
  await pool.end();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
