import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, User } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    // Check if user has permission to read users
    if (!session.user.permissions.includes('users:read')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')
    const branchId = searchParams.get('branchId')
    const role = searchParams.get('role')

    // Build where clause
    const where: any = {
      isActive: true,
    }

    // Filter by school
    if (schoolId) {
      where.schoolId = schoolId
    } else {
      where.schoolId = session.user.schoolId
    }

    // Filter by branch
    if (branchId) {
      where.branchId = branchId
    } else if (session.user.branchId) {
      where.branchId = session.user.branchId
    }

    // Filter by role
    if (role) {
      where.role = role
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
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
        firstName: 'asc',
      },
    })

    return NextResponse.json<ApiResponse<User[]>>({
      success: true,
      data: users as User[],
    })

  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}