import { NextRequest, NextResponse } from 'next/server'
import { deleteSession, getSession } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (session?.user) {
      // Log audit
      await prisma.auditLog.create({
        data: {
          schoolId: session.user.schoolId,
          branchId: session.user.branchId,
          userId: session.user.id,
          action: 'LOGOUT',
          resource: 'USER',
          resourceId: session.user.id,
          ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    }

    // Delete session
    await deleteSession()

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Logout successful',
    })

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}