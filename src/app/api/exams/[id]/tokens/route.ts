import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, ExamToken } from '@/types'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

const generateTokenSchema = z.object({
  studentIds: z.array(z.string().uuid()).optional(),
  expiresAt: z.string().datetime().optional(),
  count: z.number().min(1).max(100).default(1),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    const { id: examId } = params

    // Verify exam exists and user has access
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        classroom: true,
      },
    })

    if (!exam || !exam.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Exam not found or inactive',
      }, { status: 404 })
    }

    // Check if user can view tokens
    if (exam.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only the exam teacher can view tokens',
      }, { status: 403 })
    }

    const tokens = await prisma.examToken.findMany({
      where: { examId },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<ExamToken[]>>({
      success: true,
      data: tokens as ExamToken[],
    })

  } catch (error) {
    console.error('List exam tokens error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    const { id: examId } = params
    const body = await request.json()
    const { studentIds, expiresAt, count } = generateTokenSchema.parse(body)

    // Verify exam exists and user has access
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        classroom: {
          include: {
            enrollments: {
              where: { isActive: true },
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!exam || !exam.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Exam not found or inactive',
      }, { status: 404 })
    }

    // Check if user can generate tokens
    if (exam.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only the exam teacher can generate tokens',
      }, { status: 403 })
    }

    // Validate student IDs if provided
    if (studentIds && studentIds.length > 0) {
      const validStudentIds = exam.classroom.enrollments.map(e => e.student.id)
      const invalidIds = studentIds.filter(id => !validStudentIds.includes(id))
      
      if (invalidIds.length > 0) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `Invalid student IDs: ${invalidIds.join(', ')}`,
        }, { status: 400 })
      }
    }

    // Generate tokens
    const tokens = []
    const expirationDate = expiresAt ? new Date(expiresAt) : null

    for (let i = 0; i < count; i++) {
      const token = `EXAM-${examId.substring(0, 8).toUpperCase()}-${uuidv4().substring(0, 8).toUpperCase()}`
      
      // If specific students provided, create one token per student
      if (studentIds && studentIds.length > 0) {
        for (const studentId of studentIds) {
          tokens.push({
            examId,
            token,
            studentId,
            expiresAt: expirationDate,
            createdBy: session.user.id,
          })
        }
      } else {
        // General tokens
        tokens.push({
          examId,
          token,
          studentId: null,
          expiresAt: expirationDate,
          createdBy: session.user.id,
        })
      }
    }

    // Create tokens in database
    const createdTokens = await prisma.examToken.createMany({
      data: tokens,
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'EXAM_TOKENS_GENERATED',
        resource: 'EXAM',
        resourceId: examId,
        details: JSON.stringify({
          count: createdTokens.count,
          studentIds: studentIds || [],
          expiresAt: expirationDate,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { count: createdTokens.count },
      message: `${createdTokens.count} exam tokens generated successfully`,
    })

  } catch (error) {
    console.error('Generate exam tokens error:', error)
    
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