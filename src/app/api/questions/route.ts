import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Question } from '@/types'
import { z } from 'zod'

const createQuestionSchema = z.object({
  examId: z.string().uuid('Invalid exam ID'),
  question: z.string().min(1, 'Question is required'),
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'ESSAY', 'MATCHING']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  marks: z.number().min(1).default(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
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
    const examId = searchParams.get('examId')
    const type = searchParams.get('type')
    const difficulty = searchParams.get('difficulty')
    const subject = searchParams.get('subject')

    const where: any = {
      isActive: true,
    }

    // Filter by exam
    if (examId) {
      where.examId = examId
    } else {
      // Filter by school/branch
      where.schoolId = session.user.schoolId
      if (session.user.branchId) {
        where.branchId = session.user.branchId
      }
    }

    // Additional filters
    if (type) {
      where.type = type
    }

    if (difficulty) {
      where.difficulty = difficulty
    }

    if (subject) {
      where.subject = subject
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        exam: {
          select: {
            title: true,
            type: true,
          },
        },
        classroom: {
          select: {
            name: true,
            subject: true,
          },
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<Question[]>>({
      success: true,
      data: questions as Question[],
    })

  } catch (error) {
    console.error('List questions error:', error)
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

    // Check if user can create questions
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only teachers can create questions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { examId, question, type, options, correctAnswer, explanation, marks, difficulty } = createQuestionSchema.parse(body)

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

    // Check if user is the teacher or admin
    if (exam.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only the exam teacher can add questions',
      }, { status: 403 })
    }

    // Validate question type specific requirements
    if (type === 'MULTIPLE_CHOICE' && (!options || options.length < 2)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Multiple choice questions must have at least 2 options',
      }, { status: 400 })
    }

    if (type === 'TRUE_FALSE' && (!options || options.length !== 2)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'True/False questions must have exactly 2 options',
      }, { status: 400 })
    }

    if (['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'].includes(type) && !correctAnswer) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Correct answer is required for this question type',
      }, { status: 400 })
    }

    const questionData = await prisma.question.create({
      data: {
        examId,
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        classroomId: exam.classroomId,
        subject: exam.classroom.subject,
        term: 'Current', // This could be dynamic based on academic calendar
        teacherId: session.user.id,
        question,
        type,
        options: options || [],
        correctAnswer,
        explanation,
        marks,
        difficulty,
        createdBy: session.user.id,
      },
      include: {
        exam: {
          select: {
            title: true,
            type: true,
          },
        },
        classroom: {
          select: {
            name: true,
            subject: true,
          },
        },
        teacher: {
          select: {
            firstName: true,
            lastName: true,
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
        action: 'QUESTION_CREATED',
        resource: 'QUESTION',
        resourceId: questionData.id,
        details: JSON.stringify({
          type,
          marks,
          difficulty,
          examId,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Question>>({
      success: true,
      data: questionData as Question,
      message: 'Question created successfully',
    })

  } catch (error) {
    console.error('Create question error:', error)
    
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