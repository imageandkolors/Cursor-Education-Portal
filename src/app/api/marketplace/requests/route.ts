import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, ProductRequest } from '@/types'
import { z } from 'zod'

const createRequestSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.enum(['BOOKS', 'UNIFORMS', 'STATIONERY', 'ELECTRONICS', 'SPORTS', 'FOOD', 'TRANSPORT', 'SERVICES', 'DIGITAL', 'OTHER']),
  estimatedPrice: z.number().min(0).optional(),
  quantity: z.number().min(1).default(1),
})

const updateRequestSchema = z.object({
  requestId: z.string().uuid('Invalid request ID'),
  status: z.enum(['APPROVED', 'REJECTED', 'FULFILLED']),
  rejectionReason: z.string().optional(),
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
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const requestedBy = searchParams.get('requestedBy')

    const where: any = {
      schoolId: session.user.schoolId,
    }

    if (session.user.branchId) {
      where.branchId = session.user.branchId
    }

    // Filter by requester if not admin/store manager
    if (session.user.role !== 'ADMIN' && session.user.role !== 'STORE_MANAGER') {
      where.requestedBy = session.user.id
    } else if (requestedBy) {
      where.requestedBy = requestedBy
    }

    if (status) {
      where.status = status
    }

    if (category) {
      where.category = category
    }

    const requests = await prisma.productRequest.findMany({
      where,
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            price: true,
            imageUrl: true,
          },
        },
        requester: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<ProductRequest[]>>({
      success: true,
      data: requests as ProductRequest[],
    })

  } catch (error) {
    console.error('List product requests error:', error)
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
    const { productId, name, description, category, estimatedPrice, quantity } = createRequestSchema.parse(body)

    // If productId is provided, verify it exists
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      })

      if (!product || product.schoolId !== session.user.schoolId) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Product not found or not in same school',
        }, { status: 404 })
      }
    }

    const productRequest = await prisma.productRequest.create({
      data: {
        productId,
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        requestedBy: session.user.id,
        name,
        description,
        category,
        estimatedPrice,
        quantity,
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            price: true,
            imageUrl: true,
          },
        },
        requester: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
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
        action: 'PRODUCT_REQUEST_CREATED',
        resource: 'PRODUCT_REQUEST',
        resourceId: productRequest.id,
        details: JSON.stringify({
          name,
          category,
          quantity,
          productId,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<ProductRequest>>({
      success: true,
      data: productRequest as ProductRequest,
      message: 'Product request created successfully',
    })

  } catch (error) {
    console.error('Create product request error:', error)
    
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

    if (!session.user.permissions.includes('inventory:write') && session.user.role !== 'STORE_MANAGER') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { requestId, status, rejectionReason } = updateRequestSchema.parse(body)

    const productRequest = await prisma.productRequest.findUnique({
      where: { id: requestId },
    })

    if (!productRequest) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Product request not found',
      }, { status: 404 })
    }

    // Check if user can update this request
    if (productRequest.schoolId !== session.user.schoolId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot update request from different school',
      }, { status: 403 })
    }

    if (session.user.branchId && productRequest.branchId && productRequest.branchId !== session.user.branchId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot update request from different branch',
      }, { status: 403 })
    }

    const updateData: any = {
      status,
    }

    if (status === 'APPROVED') {
      updateData.approvedAt = new Date()
      updateData.approvedBy = session.user.id
    } else if (status === 'REJECTED') {
      updateData.rejectedAt = new Date()
      updateData.rejectedBy = session.user.id
      updateData.rejectionReason = rejectionReason
    }

    const updatedRequest = await prisma.productRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            price: true,
            imageUrl: true,
          },
        },
        requester: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
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
        action: `PRODUCT_REQUEST_${status}`,
        resource: 'PRODUCT_REQUEST',
        resourceId: requestId,
        details: JSON.stringify({
          status,
          rejectionReason,
          previousStatus: productRequest.status,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<ProductRequest>>({
      success: true,
      data: updatedRequest as ProductRequest,
      message: `Product request ${status.toLowerCase()} successfully`,
    })

  } catch (error) {
    console.error('Update product request error:', error)
    
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