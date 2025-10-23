import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Branch } from '@/types'

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

    // Check if user has permission to read branches
    if (!session.user.permissions.includes('branches:read')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const { id: schoolId } = params

    // Verify school exists and user has access
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school || !school.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'School not found or inactive',
      }, { status: 404 })
    }

    // Check if user can access this school
    if (session.user.schoolId !== schoolId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot access branches from different school',
      }, { status: 403 })
    }

    const branches = await prisma.branch.findMany({
      where: {
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json<ApiResponse<Branch[]>>({
      success: true,
      data: branches as Branch[],
    })

  } catch (error) {
    console.error('List branches error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}