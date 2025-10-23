import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ApiResponse } from '@/types'
import { z } from 'zod'

const syncSchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
  deviceId: z.string().min(1, 'Device ID is required'),
  lastSyncAt: z.string().datetime('Invalid sync time'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { licenseKey, deviceId, lastSyncAt } = syncSchema.parse(body)

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

    // Check if device is registered
    if (license.deviceId !== deviceId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Device not registered for this license',
      }, { status: 403 })
    }

    // Update last sync time
    await prisma.license.update({
      where: { id: license.id },
      data: {
        lastSyncAt: new Date(lastSyncAt),
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: license.schoolId,
        branchId: license.branchId,
        userId: license.userId,
        licenseId: license.id,
        action: 'LICENSE_SYNC',
        resource: 'LICENSE',
        resourceId: license.id,
        details: JSON.stringify({
          deviceId,
          lastSyncAt,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'License synced successfully',
    })

  } catch (error) {
    console.error('License sync error:', error)
    
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