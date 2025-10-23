import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, FeeStructure } from '@/types'
import { z } from 'zod'

const createFeeStructureSchema = z.object({
  branchId: z.string().uuid().optional(),
  classId: z.string().optional(),
  term: z.string().min(1, 'Term is required'),
  session: z.string().min(1, 'Session is required'),
  feeType: z.enum(['TUITION', 'EXAMINATION', 'LIBRARY', 'TRANSPORT', 'MEALS', 'UNIFORM', 'BOOKS', 'SPORTS', 'EXTRACURRICULAR', 'OTHER']),
  name: z.string().min(1, 'Fee name is required'),
  description: z.string().optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  dueDate: z.string().datetime('Invalid due date'),
  isRequired: z.boolean().default(true),
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

    if (!session.user.permissions.includes('financial:read')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const term = searchParams.get('term')
    const session = searchParams.get('session')
    const feeType = searchParams.get('feeType')

    const where: any = {
      schoolId: session.user.schoolId,
      isActive: true,
    }

    if (branchId) {
      where.branchId = branchId
    } else if (session.user.branchId) {
      where.branchId = session.user.branchId
    }

    if (term) {
      where.term = term
    }

    if (session) {
      where.session = session
    }

    if (feeType) {
      where.feeType = feeType
    }

    const feeStructures = await prisma.feeStructure.findMany({
      where,
      include: {
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
            payments: true,
          },
        },
      },
      orderBy: [
        { session: 'desc' },
        { term: 'desc' },
        { dueDate: 'asc' },
      ],
    })

    return NextResponse.json<ApiResponse<FeeStructure[]>>({
      success: true,
      data: feeStructures as FeeStructure[],
    })

  } catch (error) {
    console.error('List fee structures error:', error)
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

    if (!session.user.permissions.includes('financial:write')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { branchId, classId, term, session, feeType, name, description, amount, dueDate, isRequired } = createFeeStructureSchema.parse(body)

    // Validate branch access
    if (branchId && session.user.branchId && branchId !== session.user.branchId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot create fee structure for different branch',
      }, { status: 403 })
    }

    const feeStructure = await prisma.feeStructure.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: branchId || session.user.branchId,
        classId,
        term,
        session,
        feeType,
        name,
        description,
        amount,
        dueDate: new Date(dueDate),
        isRequired,
        createdBy: session.user.id,
      },
      include: {
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
        action: 'FEE_STRUCTURE_CREATED',
        resource: 'FEE_STRUCTURE',
        resourceId: feeStructure.id,
        details: JSON.stringify({
          name,
          feeType,
          amount,
          term,
          session,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<FeeStructure>>({
      success: true,
      data: feeStructure as FeeStructure,
      message: 'Fee structure created successfully',
    })

  } catch (error) {
    console.error('Create fee structure error:', error)
    
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