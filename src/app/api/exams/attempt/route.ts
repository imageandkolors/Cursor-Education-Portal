import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, ExamAttempt } from '@/types'
import { z } from 'zod'

const startAttemptSchema = z.object({
  examId: z.string().uuid('Invalid exam ID'),
  token: z.string().min(1, 'Token is required'),
  deviceInfo: z.string().optional(),
})

const submitAnswerSchema = z.object({
  questionId: z.string().uuid('Invalid question ID'),
  answer: z.string(),
  timeSpent: z.number().min(0).optional(),
})

const submitAttemptSchema = z.object({
  attemptId: z.string().uuid('Invalid attempt ID'),
  answers: z.array(submitAnswerSchema),
  cheatAttempts: z.number().min(0).default(0),
  tabSwitches: z.number().min(0).default(0),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    const body = await request.json()
    const { examId, token, deviceInfo } = startAttemptSchema.parse(body)

    // Verify exam exists and is active
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        classroom: {
          include: {
            enrollments: {
              where: {
                studentId: session.user.id,
                isActive: true,
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

    // Check if student is enrolled
    if (exam.classroom.enrollments.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Student not enrolled in this classroom',
      }, { status: 403 })
    }

    // Verify token
    const examToken = await prisma.examToken.findUnique({
      where: { token },
    })

    if (!examToken || examToken.examId !== examId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid exam token',
      }, { status: 400 })
    }

    if (examToken.isUsed) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Token already used',
      }, { status: 400 })
    }

    if (examToken.expiresAt && new Date(examToken.expiresAt) < new Date()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Token has expired',
      }, { status: 400 })
    }

    // Check if token is for specific student
    if (examToken.studentId && examToken.studentId !== session.user.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Token not valid for this student',
      }, { status: 403 })
    }

    // Check exam timing
    const now = new Date()
    if (now < exam.startDate) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Exam has not started yet',
      }, { status: 400 })
    }

    if (now > exam.endDate) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Exam has ended',
      }, { status: 400 })
    }

    // Check existing attempts
    const existingAttempts = await prisma.examAttempt.count({
      where: {
        examId,
        studentId: session.user.id,
        status: {
          in: ['IN_PROGRESS', 'SUBMITTED'],
        },
      },
    })

    if (existingAttempts >= exam.maxAttempts) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Maximum attempts reached',
      }, { status: 400 })
    }

    // Create exam attempt
    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId: session.user.id,
        token,
        startTime: now,
        deviceInfo: deviceInfo || JSON.stringify({
          userAgent: request.headers.get('user-agent'),
          ip: request.ip || request.headers.get('x-forwarded-for'),
          timestamp: now.toISOString(),
        }),
      },
    })

    // Mark token as used
    await prisma.examToken.update({
      where: { id: examToken.id },
      data: {
        isUsed: true,
        usedAt: now,
      },
    })

    // Get randomized questions for this student
    const questions = await prisma.question.findMany({
      where: {
        examId,
        isActive: true,
      },
      orderBy: {
        id: 'asc', // This will be randomized on the frontend
      },
    })

    // Shuffle questions (simple randomization)
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5)

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'EXAM_ATTEMPT_STARTED',
        resource: 'EXAM_ATTEMPT',
        resourceId: attempt.id,
        details: JSON.stringify({
          examId,
          token,
          questionCount: shuffledQuestions.length,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<ExamAttempt>>({
      success: true,
      data: {
        ...attempt,
        questions: shuffledQuestions,
      } as ExamAttempt,
      message: 'Exam attempt started successfully',
    })

  } catch (error) {
    console.error('Start exam attempt error:', error)
    
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

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    const body = await request.json()
    const { attemptId, answers, cheatAttempts, tabSwitches } = submitAttemptSchema.parse(body)

    // Verify attempt exists and belongs to user
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
      },
    })

    if (!attempt || attempt.studentId !== session.user.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Exam attempt not found',
      }, { status: 404 })
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Exam attempt already submitted',
      }, { status: 400 })
    }

    // Check if exam is still active
    const now = new Date()
    if (now > attempt.exam.endDate) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Exam time has expired',
      }, { status: 400 })
    }

    // Process answers and calculate marks
    let totalMarks = 0
    let marksObtained = 0

    for (const answer of answers) {
      const question = await prisma.question.findUnique({
        where: { id: answer.questionId },
      })

      if (!question) continue

      let isCorrect = false
      let answerMarks = 0

      // Auto-grade objective questions
      if (['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'].includes(question.type)) {
        isCorrect = answer.answer.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim()
        answerMarks = isCorrect ? question.marks : 0
      } else {
        // Subjective questions - teacher will grade later
        answerMarks = 0
      }

      // Save answer
      await prisma.answer.upsert({
        where: {
          questionId_studentId: {
            questionId: answer.questionId,
            studentId: session.user.id,
          },
        },
        update: {
          answer: answer.answer,
          isCorrect,
          marksObtained: answerMarks,
          timeSpent: answer.timeSpent,
        },
        create: {
          questionId: answer.questionId,
          studentId: session.user.id,
          answer: answer.answer,
          isCorrect,
          marksObtained: answerMarks,
          timeSpent: answer.timeSpent,
        },
      })

      totalMarks += question.marks
      marksObtained += answerMarks
    }

    const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0

    // Update attempt
    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        endTime: now,
        submittedAt: now,
        totalMarks,
        marksObtained,
        percentage,
        status: 'SUBMITTED',
        cheatAttempts,
        tabSwitches,
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'EXAM_ATTEMPT_SUBMITTED',
        resource: 'EXAM_ATTEMPT',
        resourceId: attemptId,
        details: JSON.stringify({
          totalMarks,
          marksObtained,
          percentage,
          cheatAttempts,
          tabSwitches,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<ExamAttempt>>({
      success: true,
      data: updatedAttempt as ExamAttempt,
      message: 'Exam submitted successfully',
    })

  } catch (error) {
    console.error('Submit exam attempt error:', error)
    
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