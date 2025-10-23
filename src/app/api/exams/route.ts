import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Exam } from '@/types'
import { z } from 'zod'

const createExamSchema = z.object({
  classroomId: z.string().uuid('Invalid classroom ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['ASSIGNMENT', 'QUIZ', 'MIDTERM', 'FINAL', 'PRACTICE']).default('ASSIGNMENT'),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  totalMarks: z.number().min(1, 'Total marks must be at least 1'),
  passingMarks: z.number().min(0, 'Passing marks cannot be negative'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  allowRetake: z.boolean().default(false),
  maxAttempts: z.number().min(1).default(1),
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
    const classroomId = searchParams.get('classroomId')
    const type = searchParams.get('type')
    const isPublished = searchParams.get('isPublished')

    const where: any = {
      isActive: true,
    }

    // Filter by classroom
    if (classroomId) {
      where.classroomId = classroomId
    } else {
      // Filter by user's classrooms
      if (session.user.role === 'TEACHER') {
        where.teacherId = session.user.id
      } else if (session.user.role === 'STUDENT') {
        where.classroom = {
          enrollments: {
            some: {
              studentId: session.user.id,
              isActive: true,
            },
          },
        }
      } else {
        // Admin - show all exams in school
        where.classroom = {
          schoolId: session.user.schoolId,
        }
        if (session.user.branchId) {
          where.classroom.branchId = session.user.branchId
        }
      }
    }

    // Additional filters
    if (type) {
      where.type = type
    }

    if (isPublished !== null) {
      where.isPublished = isPublished === 'true'
    }

    const exams = await prisma.exam.findMany({
      where,
      include: {
        classroom: {
          select: {
            name: true,
            code: true,
            subject: true,
          },
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            questions: true,
            attempts: true,
            tokens: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<Exam[]>>({
      success: true,
      data: exams as Exam[],
    })

  } catch (error) {
    console.error('List exams error:', error)
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

    // Check if user can create exams
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only teachers can create exams',
      }, { status: 403 })
    }

    const body = await request.json()
    const { classroomId, title, description, type, duration, totalMarks, passingMarks, startDate, endDate, allowRetake, maxAttempts } = createExamSchema.parse(body)

    // Verify classroom exists and user has access
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
    })

    if (!classroom || !classroom.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Classroom not found or inactive',
      }, { status: 404 })
    }

    // Check if user is the teacher or admin
    if (classroom.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only the classroom teacher can create exams',
      }, { status: 403 })
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()

    if (start <= now) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Start date must be in the future',
      }, { status: 400 })
    }

    if (end <= start) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'End date must be after start date',
      }, { status: 400 })
    }

    // Validate passing marks
    if (passingMarks > totalMarks) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Passing marks cannot exceed total marks',
      }, { status: 400 })
    }

    const exam = await prisma.exam.create({
      data: {
        classroomId,
        teacherId: session.user.id,
        title,
        description,
        type,
        duration,
        totalMarks,
        passingMarks,
        startDate: start,
        endDate: end,
        allowRetake,
        maxAttempts,
      },
      include: {
        classroom: {
          select: {
            name: true,
            code: true,
            subject: true,
          },
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
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
        action: 'EXAM_CREATED',
        resource: 'EXAM',
        resourceId: exam.id,
        details: JSON.stringify({
          title,
          type,
          duration,
          totalMarks,
          classroomId,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Exam>>({
      success: true,
      data: exam as Exam,
      message: 'Exam created successfully',
    })

  } catch (error) {
    console.error('Create exam error:', error)
    
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