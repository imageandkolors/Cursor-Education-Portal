import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Payment } from '@/types'
import { z } from 'zod'

const createPaymentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  feeStructureId: z.string().uuid('Invalid fee structure ID'),
  amount: z.number().min(0, 'Amount must be positive'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'ONLINE']),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

const verifyPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  status: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().optional(),
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
    const studentId = searchParams.get('studentId')
    const status = searchParams.get('status')
    const feeType = searchParams.get('feeType')
    const term = searchParams.get('term')
    const session = searchParams.get('session')

    const where: any = {
      schoolId: session.user.schoolId,
    }

    if (session.user.branchId) {
      where.branchId = session.user.branchId
    }

    if (studentId) {
      where.studentId = studentId
    }

    if (status) {
      where.status = status
    }

    if (term) {
      where.feeStructure = {
        term,
      }
    }

    if (session) {
      where.feeStructure = {
        ...where.feeStructure,
        session,
      }
    }

    if (feeType) {
      where.feeStructure = {
        ...where.feeStructure,
        feeType,
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            username: true,
          },
        },
        feeStructure: {
          select: {
            name: true,
            feeType: true,
            term: true,
            session: true,
            dueDate: true,
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
            receipts: true,
            eReceipts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<Payment[]>>({
      success: true,
      data: payments as Payment[],
    })

  } catch (error) {
    console.error('List payments error:', error)
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

    const body = await request.json()
    const { studentId, feeStructureId, amount, paymentMethod, reference, notes } = createPaymentSchema.parse(body)

    // Verify fee structure exists and is active
    const feeStructure = await prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
    })

    if (!feeStructure || !feeStructure.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Fee structure not found or inactive',
      }, { status: 404 })
    }

    // Verify student exists and belongs to same school
    const student = await prisma.user.findUnique({
      where: { id: studentId },
    })

    if (!student || !student.isActive || student.schoolId !== session.user.schoolId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Student not found or not in same school',
      }, { status: 404 })
    }

    // Check if payment already exists for this fee structure and student
    const existingPayment = await prisma.payment.findFirst({
      where: {
        studentId,
        feeStructureId,
        status: {
          in: ['PENDING', 'VERIFIED'],
        },
      },
    })

    if (existingPayment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment already exists for this fee structure',
      }, { status: 400 })
    }

    const payment = await prisma.payment.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        studentId,
        feeStructureId,
        amount,
        paymentMethod,
        reference,
        notes,
        createdBy: session.user.id,
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            username: true,
          },
        },
        feeStructure: {
          select: {
            name: true,
            feeType: true,
            term: true,
            session: true,
            dueDate: true,
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
        action: 'PAYMENT_CREATED',
        resource: 'PAYMENT',
        resourceId: payment.id,
        details: JSON.stringify({
          studentId,
          feeStructureId,
          amount,
          paymentMethod,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Payment>>({
      success: true,
      data: payment as Payment,
      message: 'Payment created successfully',
    })

  } catch (error) {
    console.error('Create payment error:', error)
    
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

    if (!session.user.permissions.includes('financial:write')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { paymentId, status, notes } = verifyPaymentSchema.parse(body)

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    })

    if (!payment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment not found',
      }, { status: 404 })
    }

    // Check if user can verify this payment
    if (payment.schoolId !== session.user.schoolId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot verify payment from different school',
      }, { status: 403 })
    }

    if (session.user.branchId && payment.branchId && payment.branchId !== session.user.branchId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot verify payment from different branch',
      }, { status: 403 })
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        verifiedAt: new Date(),
        verifiedBy: session.user.id,
        notes: notes || payment.notes,
        paidAt: status === 'VERIFIED' ? new Date() : payment.paidAt,
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            username: true,
          },
        },
        feeStructure: {
          select: {
            name: true,
            feeType: true,
            term: true,
            session: true,
            dueDate: true,
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
        action: `PAYMENT_${status}`,
        resource: 'PAYMENT',
        resourceId: paymentId,
        details: JSON.stringify({
          status,
          notes,
          previousStatus: payment.status,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Payment>>({
      success: true,
      data: updatedPayment as Payment,
      message: `Payment ${status.toLowerCase()} successfully`,
    })

  } catch (error) {
    console.error('Verify payment error:', error)
    
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