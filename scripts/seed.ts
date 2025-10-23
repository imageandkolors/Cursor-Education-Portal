import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a school
  const school = await prisma.school.create({
    data: {
      name: 'Demo School',
      code: 'DEMO001',
      address: '123 Education Street, Learning City',
      phone: '+1-555-0123',
      email: 'info@demoschool.edu',
      website: 'https://demoschool.edu',
      isActive: true,
    },
  })

  console.log('✅ Created school:', school.name)

  // Create a branch
  const branch = await prisma.branch.create({
    data: {
      schoolId: school.id,
      name: 'Main Campus',
      code: 'MAIN',
      address: '123 Education Street, Learning City',
      phone: '+1-555-0123',
      email: 'main@demoschool.edu',
      isActive: true,
    },
  })

  console.log('✅ Created branch:', branch.name)

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      branchId: branch.id,
      email: 'admin@demoschool.edu',
      username: 'admin',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+1-555-0123',
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log('✅ Created admin user:', admin.email)

  // Create teacher user
  const teacherPassword = await bcrypt.hash('teacher123', 12)
  const teacher = await prisma.user.create({
    data: {
      schoolId: school.id,
      branchId: branch.id,
      email: 'teacher@demoschool.edu',
      username: 'teacher',
      password: teacherPassword,
      firstName: 'John',
      lastName: 'Teacher',
      phone: '+1-555-0124',
      role: 'TEACHER',
      isActive: true,
    },
  })

  console.log('✅ Created teacher user:', teacher.email)

  // Create student user
  const studentPassword = await bcrypt.hash('student123', 12)
  const student = await prisma.user.create({
    data: {
      schoolId: school.id,
      branchId: branch.id,
      email: 'student@demoschool.edu',
      username: 'student',
      password: studentPassword,
      firstName: 'Jane',
      lastName: 'Student',
      phone: '+1-555-0125',
      role: 'STUDENT',
      isActive: true,
    },
  })

  console.log('✅ Created student user:', student.email)

  // Create a demo license
  const license = await prisma.license.create({
    data: {
      schoolId: school.id,
      branchId: branch.id,
      userId: admin.id,
      licenseKey: 'DEMO-LICENSE-KEY-12345',
      licenseType: 'EDUCATIONAL',
      status: 'ACTIVE',
      maxDevices: 5,
      features: [
        'student_management',
        'teacher_management',
        'parent_portal',
        'reporting',
        'offline_mode',
      ],
      isOfflineMode: true,
      createdBy: admin.id,
    },
  })

  console.log('✅ Created demo license:', license.licenseKey)

  // Create some notifications
  await prisma.notification.createMany({
    data: [
      {
        schoolId: school.id,
        branchId: branch.id,
        userId: admin.id,
        title: 'Welcome to SmartEdu360',
        message: 'Your educational platform is ready to use!',
        type: 'INFO',
        isGlobal: false,
        createdBy: admin.id,
      },
      {
        schoolId: school.id,
        branchId: branch.id,
        userId: teacher.id,
        title: 'New Assignment Posted',
        message: 'A new assignment has been posted in your class.',
        type: 'INFO',
        isGlobal: false,
        createdBy: admin.id,
      },
    ],
  })

  console.log('✅ Created notifications')

  // Create school settings
  await prisma.schoolSettings.createMany({
    data: [
      {
        schoolId: school.id,
        key: 'school_name',
        value: 'Demo School',
        description: 'Official name of the school',
        createdBy: admin.id,
      },
      {
        schoolId: school.id,
        key: 'timezone',
        value: 'America/New_York',
        description: 'School timezone',
        createdBy: admin.id,
      },
      {
        schoolId: school.id,
        key: 'currency',
        value: 'USD',
        description: 'Default currency',
        createdBy: admin.id,
      },
    ],
  })

  console.log('✅ Created school settings')

  console.log('🎉 Database seeded successfully!')
  console.log('\n📋 Demo Accounts:')
  console.log('Admin: admin@demoschool.edu / admin123')
  console.log('Teacher: teacher@demoschool.edu / teacher123')
  console.log('Student: student@demoschool.edu / student123')
  console.log('\n🔑 Demo License Key: DEMO-LICENSE-KEY-12345')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })