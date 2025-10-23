import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ApiResponse, License, LicenseVerification, DeviceInfo } from '@/types'
import { z } from 'zod'

const verifySchema = z.object({
  licenseKey: z.string().min(1, 'License key is required'),
  schoolId: z.string().uuid('Invalid school ID'),
  branchId: z.string().uuid().optional(),
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceInfo: z.object({
    deviceName: z.string(),
    platform: z.enum(['web', 'android', 'ios', 'desktop']),
    version: z.string(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { licenseKey, schoolId, branchId, deviceId, deviceInfo } = verifySchema.parse(body)

    // Find license
    const license = await prisma.license.findUnique({
      where: { licenseKey },
      include: {
        school: true,
        branch: true,
        user: true,
      },
    })

    if (!license) {
      return NextResponse.json<ApiResponse<LicenseVerification>>({
        success: false,
        data: {
          isValid: false,
          error: 'License not found',
        },
      }, { status: 404 })
    }

    // Check if license belongs to the school
    if (license.schoolId !== schoolId) {
      return NextResponse.json<ApiResponse<LicenseVerification>>({
        success: false,
        data: {
          isValid: false,
          error: 'License does not belong to this school',
        },
      }, { status: 403 })
    }

    // Check if license belongs to the branch (if specified)
    if (branchId && license.branchId && license.branchId !== branchId) {
      return NextResponse.json<ApiResponse<LicenseVerification>>({
        success: false,
        data: {
          isValid: false,
          error: 'License does not belong to this branch',
        },
      }, { status: 403 })
    }

    // Check license status
    if (license.status !== 'ACTIVE') {
      return NextResponse.json<ApiResponse<LicenseVerification>>({
        success: false,
        data: {
          isValid: false,
          error: `License is ${license.status.toLowerCase()}`,
        },
      }, { status: 403 })
    }

    // Check if license is expired
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      // Update license status to expired
      await prisma.license.update({
        where: { id: license.id },
        data: { status: 'EXPIRED' },
      })

      return NextResponse.json<ApiResponse<LicenseVerification>>({
        success: false,
        data: {
          isValid: false,
          error: 'License has expired',
        },
      }, { status: 403 })
    }

    // Check device limit
    if (license.usedDevices >= license.maxDevices) {
      return NextResponse.json<ApiResponse<LicenseVerification>>({
        success: false,
        data: {
          isValid: false,
          error: 'Maximum number of devices reached',
        },
      }, { status: 403 })
    }

    // Check if device is already registered
    const existingDevice = license.deviceId === deviceId

    if (!existingDevice) {
      // Register new device
      await prisma.license.update({
        where: { id: license.id },
        data: {
          deviceId,
          deviceName: deviceInfo?.deviceName || 'Unknown Device',
          usedDevices: license.usedDevices + 1,
          lastSyncAt: new Date(),
        },
      })

      // Log audit
      await prisma.auditLog.create({
        data: {
          schoolId: license.schoolId,
          branchId: license.branchId,
          userId: license.userId,
          licenseId: license.id,
          action: 'DEVICE_REGISTERED',
          resource: 'LICENSE',
          resourceId: license.id,
          details: JSON.stringify({
            deviceId,
            deviceName: deviceInfo?.deviceName,
            platform: deviceInfo?.platform,
          }),
          ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    } else {
      // Update last sync time
      await prisma.license.update({
        where: { id: license.id },
        data: {
          lastSyncAt: new Date(),
        },
      })
    }

    // Return updated license
    const updatedLicense = await prisma.license.findUnique({
      where: { id: license.id },
    })

    return NextResponse.json<ApiResponse<LicenseVerification>>({
      success: true,
      data: {
        isValid: true,
        license: updatedLicense as License,
        offlineMode: false,
      },
    })

  } catch (error) {
    console.error('License verification error:', error)
    
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