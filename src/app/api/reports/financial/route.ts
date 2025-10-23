import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { z } from 'zod'

const reportSchema = z.object({
  type: z.enum(['daily', 'term', 'session', 'outstanding']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
  term: z.string().optional(),
  session: z.string().optional(),
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

    if (!session.user.permissions.includes('reports:read')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'daily' | 'term' | 'session' | 'outstanding'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const branchId = searchParams.get('branchId')
    const term = searchParams.get('term')
    const session = searchParams.get('session')

    const { type: reportType, startDate: start, endDate: end, branchId: branch, term: reportTerm, session: reportSession } = reportSchema.parse({
      type,
      startDate,
      endDate,
      branchId,
      term: reportTerm,
      session: reportSession,
    })

    const where: any = {
      schoolId: session.user.schoolId,
    }

    if (branch || session.user.branchId) {
      where.branchId = branch || session.user.branchId
    }

    let reportData: any = {}

    switch (reportType) {
      case 'daily':
        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

        where.createdAt = {
          gte: startOfDay,
          lt: endOfDay,
        }

        const dailyPayments = await prisma.payment.findMany({
          where,
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            feeStructure: {
              select: {
                name: true,
                feeType: true,
              },
            },
          },
        })

        const dailyStats = await prisma.payment.aggregate({
          where,
          _sum: {
            amount: true,
          },
          _count: {
            id: true,
          },
        })

        reportData = {
          date: today.toISOString().split('T')[0],
          totalAmount: dailyStats._sum.amount || 0,
          totalPayments: dailyStats._count.id || 0,
          payments: dailyPayments,
          summary: {
            byStatus: await getPaymentSummaryByStatus(where),
            byFeeType: await getPaymentSummaryByFeeType(where),
            byPaymentMethod: await getPaymentSummaryByMethod(where),
          },
        }
        break

      case 'term':
        if (!reportTerm) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Term is required for term report',
          }, { status: 400 })
        }

        where.feeStructure = {
          term: reportTerm,
        }

        const termPayments = await prisma.payment.findMany({
          where,
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            feeStructure: {
              select: {
                name: true,
                feeType: true,
                dueDate: true,
              },
            },
          },
        })

        const termStats = await prisma.payment.aggregate({
          where,
          _sum: {
            amount: true,
          },
          _count: {
            id: true,
          },
        })

        reportData = {
          term: reportTerm,
          totalAmount: termStats._sum.amount || 0,
          totalPayments: termStats._count.id || 0,
          payments: termPayments,
          summary: {
            byStatus: await getPaymentSummaryByStatus(where),
            byFeeType: await getPaymentSummaryByFeeType(where),
            byPaymentMethod: await getPaymentSummaryByMethod(where),
            outstanding: await getOutstandingPayments(where),
          },
        }
        break

      case 'session':
        if (!reportSession) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: 'Session is required for session report',
          }, { status: 400 })
        }

        where.feeStructure = {
          session: reportSession,
        }

        const sessionPayments = await prisma.payment.findMany({
          where,
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            feeStructure: {
              select: {
                name: true,
                feeType: true,
                term: true,
                dueDate: true,
              },
            },
          },
        })

        const sessionStats = await prisma.payment.aggregate({
          where,
          _sum: {
            amount: true,
          },
          _count: {
            id: true,
          },
        })

        reportData = {
          session: reportSession,
          totalAmount: sessionStats._sum.amount || 0,
          totalPayments: sessionStats._count.id || 0,
          payments: sessionPayments,
          summary: {
            byStatus: await getPaymentSummaryByStatus(where),
            byFeeType: await getPaymentSummaryByFeeType(where),
            byPaymentMethod: await getPaymentSummaryByMethod(where),
            byTerm: await getPaymentSummaryByTerm(where),
            outstanding: await getOutstandingPayments(where),
          },
        }
        break

      case 'outstanding':
        const outstandingPayments = await prisma.payment.findMany({
          where: {
            ...where,
            status: 'PENDING',
            feeStructure: {
              dueDate: {
                lt: new Date(),
              },
            },
          },
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
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
          },
          orderBy: {
            feeStructure: {
              dueDate: 'asc',
            },
          },
        })

        const outstandingStats = await prisma.payment.aggregate({
          where: {
            ...where,
            status: 'PENDING',
            feeStructure: {
              dueDate: {
                lt: new Date(),
              },
            },
          },
          _sum: {
            amount: true,
          },
          _count: {
            id: true,
          },
        })

        reportData = {
          totalOutstanding: outstandingStats._sum.amount || 0,
          totalCount: outstandingStats._count.id || 0,
          payments: outstandingPayments,
          summary: {
            byFeeType: await getOutstandingSummaryByFeeType(where),
            byStudent: await getOutstandingSummaryByStudent(where),
            byDueDate: await getOutstandingSummaryByDueDate(where),
          },
        }
        break
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: reportData,
    })

  } catch (error) {
    console.error('Generate financial report error:', error)
    
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

async function getPaymentSummaryByStatus(where: any) {
  const summary = await prisma.payment.groupBy({
    by: ['status'],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  })

  return summary.map(item => ({
    status: item.status,
    amount: item._sum.amount || 0,
    count: item._count.id || 0,
  }))
}

async function getPaymentSummaryByFeeType(where: any) {
  const summary = await prisma.payment.groupBy({
    by: ['feeStructureId'],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  })

  const feeStructures = await prisma.feeStructure.findMany({
    where: {
      id: {
        in: summary.map(item => item.feeStructureId),
      },
    },
    select: {
      id: true,
      name: true,
      feeType: true,
    },
  })

  return summary.map(item => {
    const feeStructure = feeStructures.find(fs => fs.id === item.feeStructureId)
    return {
      feeType: feeStructure?.feeType || 'UNKNOWN',
      name: feeStructure?.name || 'Unknown',
      amount: item._sum.amount || 0,
      count: item._count.id || 0,
    }
  })
}

async function getPaymentSummaryByMethod(where: any) {
  const summary = await prisma.payment.groupBy({
    by: ['paymentMethod'],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  })

  return summary.map(item => ({
    method: item.paymentMethod,
    amount: item._sum.amount || 0,
    count: item._count.id || 0,
  }))
}

async function getPaymentSummaryByTerm(where: any) {
  const summary = await prisma.payment.groupBy({
    by: ['feeStructureId'],
    where,
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  })

  const feeStructures = await prisma.feeStructure.findMany({
    where: {
      id: {
        in: summary.map(item => item.feeStructureId),
      },
    },
    select: {
      id: true,
      term: true,
      session: true,
    },
  })

  return summary.map(item => {
    const feeStructure = feeStructures.find(fs => fs.id === item.feeStructureId)
    return {
      term: feeStructure?.term || 'UNKNOWN',
      session: feeStructure?.session || 'UNKNOWN',
      amount: item._sum.amount || 0,
      count: item._count.id || 0,
    }
  })
}

async function getOutstandingPayments(where: any) {
  return await prisma.payment.count({
    where: {
      ...where,
      status: 'PENDING',
      feeStructure: {
        dueDate: {
          lt: new Date(),
        },
      },
    },
  })
}

async function getOutstandingSummaryByFeeType(where: any) {
  const summary = await prisma.payment.groupBy({
    by: ['feeStructureId'],
    where: {
      ...where,
      status: 'PENDING',
      feeStructure: {
        dueDate: {
          lt: new Date(),
        },
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  })

  const feeStructures = await prisma.feeStructure.findMany({
    where: {
      id: {
        in: summary.map(item => item.feeStructureId),
      },
    },
    select: {
      id: true,
      name: true,
      feeType: true,
    },
  })

  return summary.map(item => {
    const feeStructure = feeStructures.find(fs => fs.id === item.feeStructureId)
    return {
      feeType: feeStructure?.feeType || 'UNKNOWN',
      name: feeStructure?.name || 'Unknown',
      amount: item._sum.amount || 0,
      count: item._count.id || 0,
    }
  })
}

async function getOutstandingSummaryByStudent(where: any) {
  const summary = await prisma.payment.groupBy({
    by: ['studentId'],
    where: {
      ...where,
      status: 'PENDING',
      feeStructure: {
        dueDate: {
          lt: new Date(),
        },
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  })

  const students = await prisma.user.findMany({
    where: {
      id: {
        in: summary.map(item => item.studentId),
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  return summary.map(item => {
    const student = students.find(s => s.id === item.studentId)
    return {
      studentId: item.studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
      studentEmail: student?.email || 'Unknown',
      amount: item._sum.amount || 0,
      count: item._count.id || 0,
    }
  })
}

async function getOutstandingSummaryByDueDate(where: any) {
  const summary = await prisma.payment.groupBy({
    by: ['feeStructureId'],
    where: {
      ...where,
      status: 'PENDING',
      feeStructure: {
        dueDate: {
          lt: new Date(),
        },
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  })

  const feeStructures = await prisma.feeStructure.findMany({
    where: {
      id: {
        in: summary.map(item => item.feeStructureId),
      },
    },
    select: {
      id: true,
      dueDate: true,
      name: true,
    },
  })

  return summary.map(item => {
    const feeStructure = feeStructures.find(fs => fs.id === item.feeStructureId)
    return {
      dueDate: feeStructure?.dueDate || new Date(),
      name: feeStructure?.name || 'Unknown',
      amount: item._sum.amount || 0,
      count: item._count.id || 0,
    }
  })
}