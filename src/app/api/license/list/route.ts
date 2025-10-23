import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, PaginatedResponse, License } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    // Check if user has permission to read licenses
    if (!session.user.permissions.includes('licenses:read')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const licenseType = searchParams.get('type') || ''
    const branchId = searchParams.get('branchId') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      schoolId: session.user.schoolId,
    }

    // Filter by branch if user belongs to a branch
    if (session.user.branchId) {
      where.branchId = session.user.branchId
    } else if (branchId) {
      where.branchId = branchId
    }

    // Add search filters
    if (search) {
      where.OR = [
        { licenseKey: { contains: search, mode: 'insensitive' } },
        { deviceName: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (licenseType) {
      where.licenseType = licenseType
    }

    // Get total count
    const total = await prisma.license.count({ where })

    // Get licenses
    const licenses = await prisma.license.findMany({
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
        user: {
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
      skip,
      take: limit,
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json<PaginatedResponse<License>>({
      success: true,
      data: licenses as License[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })

  } catch (error) {
    console.error('List licenses error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}