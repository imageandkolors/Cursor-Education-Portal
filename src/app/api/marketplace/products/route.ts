import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Product } from '@/types'
import { z } from 'zod'

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.enum(['BOOKS', 'UNIFORMS', 'STATIONERY', 'ELECTRONICS', 'SPORTS', 'FOOD', 'TRANSPORT', 'SERVICES', 'DIGITAL', 'OTHER']),
  type: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE']),
  price: z.number().min(0, 'Price must be positive'),
  cost: z.number().min(0, 'Cost must be positive').optional(),
  sku: z.string().min(1, 'SKU is required'),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  isDigital: z.boolean().default(false),
  filePath: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  downloadLimit: z.number().min(1).optional(),
  downloadExpiry: z.number().min(1).optional(),
  imageUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
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
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive') !== 'false'

    const where: any = {
      schoolId: session.user.schoolId,
      isActive,
    }

    if (session.user.branchId) {
      where.branchId = session.user.branchId
    }

    if (category) {
      where.category = category
    }

    if (type) {
      where.type = type
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ]
    }

    const products = await prisma.product.findMany({
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
            orders: true,
            requests: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<Product[]>>({
      success: true,
      data: products as Product[],
    })

  } catch (error) {
    console.error('List products error:', error)
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

    if (!session.user.permissions.includes('inventory:write') && session.user.role !== 'STORE_MANAGER') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      category, 
      type, 
      price, 
      cost, 
      sku, 
      stock, 
      minStock, 
      isDigital, 
      filePath, 
      fileSize, 
      mimeType, 
      downloadLimit, 
      downloadExpiry, 
      imageUrl, 
      tags 
    } = createProductSchema.parse(body)

    // Check if SKU already exists
    const existingProduct = await prisma.product.findUnique({
      where: { sku },
    })

    if (existingProduct) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'SKU already exists',
      }, { status: 400 })
    }

    // Validate digital product requirements
    if (isDigital && type === 'DIGITAL') {
      if (!filePath || !fileSize || !mimeType) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Digital products require file path, size, and MIME type',
        }, { status: 400 })
      }

      if (!downloadLimit || !downloadExpiry) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Digital products require download limit and expiry',
        }, { status: 400 })
      }
    }

    const product = await prisma.product.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        name,
        description,
        category,
        type,
        price,
        cost: cost || 0,
        sku,
        stock,
        minStock,
        isDigital,
        filePath,
        fileSize,
        mimeType,
        downloadLimit,
        downloadExpiry,
        imageUrl,
        tags,
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
        action: 'PRODUCT_CREATED',
        resource: 'PRODUCT',
        resourceId: product.id,
        details: JSON.stringify({
          name,
          category,
          type,
          price,
          sku,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Product>>({
      success: true,
      data: product as Product,
      message: 'Product created successfully',
    })

  } catch (error) {
    console.error('Create product error:', error)
    
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