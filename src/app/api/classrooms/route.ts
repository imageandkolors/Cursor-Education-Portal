import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Classroom } from '@/types'
import { z } from 'zod'

const createClassroomSchema = z.object({
  name: z.string().min(1, 'Classroom name is required'),
  description: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  grade: z.string().optional(),
  isPublic: z.boolean().default(false),
  maxStudents: z.number().min(1).max(200).default(50),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive') !== 'false'

    const where: any = {
      isActive,
    }

    // Filter by role
    if (role === 'teacher') {
      where.teacherId = session.user.id
    } else if (role === 'student') {
      where.enrollments = {
        some: {
          studentId: session.user.id,
          isActive: true,
        },
      }
    } else {
      // Admin or other roles - show all classrooms in school
      where.schoolId = session.user.schoolId
      if (session.user.branchId) {
        where.branchId = session.user.branchId
      }
    }

    const classrooms = await prisma.classroom.findMany({
      where,
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        school: {
          select: {
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            enrollments: {
              where: { isActive: true },
            },
            materials: true,
            discussions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<Classroom[]>>({
      success: true,
      data: classrooms as Classroom[],
    })

  } catch (error) {
    console.error('List classrooms error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    // Check if user can create classrooms
    if (!session.user.permissions.includes('classrooms:write') && session.user.role !== 'TEACHER') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, subject, grade, isPublic, maxStudents } = createClassroomSchema.parse(body)

    // Generate unique classroom code
    const code = await generateUniqueClassroomCode()

    const classroom = await prisma.classroom.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        teacherId: session.user.id,
        name,
        description,
        subject,
        grade,
        isPublic,
        maxStudents,
        code,
      },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        school: {
          select: {
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'CLASSROOM_CREATED',
        resource: 'CLASSROOM',
        resourceId: classroom.id,
        details: JSON.stringify({
          name,
          subject,
          code,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Classroom>>({
      success: true,
      data: classroom as Classroom,
      message: 'Classroom created successfully',
    })

  } catch (error) {
    console.error('Create classroom error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: error.errors[0].message,
      }, { status: 400 })
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}

async function generateUniqueClassroomCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code: string
  
  do {
    code = ''
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }
  } while (await prisma.classroom.findUnique({ where: { code } }))
  
  return code
}