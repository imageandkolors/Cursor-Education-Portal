import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { z } from 'zod'

const revokeSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
  reason: z.string().min(1, 'Reason is required'),
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

    // Check if user has permission to revoke licenses
    if (!session.user.permissions.includes('licenses:write')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { licenseKey, reason } = revokeSchema.parse(body)

    // Find license
    const license = await prisma.license.findUnique({
      where: { licenseKey },
    })

    if (!license) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'License not found',
      }, { status: 404 })
    }

    // Check if user can revoke this license (same school)
    if (license.schoolId !== session.user.schoolId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot revoke license from different school',
      }, { status: 403 })
    }

    // Check if user can revoke this license (same branch if user belongs to a branch)
    if (session.user.branchId && license.branchId && license.branchId !== session.user.branchId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot revoke license from different branch',
      }, { status: 403 })
    }

    // Revoke license
    await prisma.license.update({
      where: { id: license.id },
      data: {
        status: 'REVOKED',
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: license.schoolId,
        branchId: license.branchId,
        userId: session.user.id,
        licenseId: license.id,
        action: 'LICENSE_REVOKED',
        resource: 'LICENSE',
        resourceId: license.id,
        details: JSON.stringify({
          reason,
          revokedBy: session.user.id,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    // Create notification for license owner
    if (license.userId) {
      await prisma.notification.create({
        data: {
          schoolId: license.schoolId,
          branchId: license.branchId,
          userId: license.userId,
          title: 'License Revoked',
          message: `Your license has been revoked. Reason: ${reason}`,
          type: 'LICENSE_REVOKED',
          createdBy: session.user.id,
        },
      })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'License revoked successfully',
    })

  } catch (error) {
    console.error('License revocation error:', error)
    
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