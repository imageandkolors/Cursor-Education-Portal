import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { licenseManager } from '@/lib/license'
import { ApiResponse, License, LicenseFeatures } from '@/types'
import { z } from 'zod'

const createLicenseSchema = z.object({
  schoolId: z.string().uuid('Invalid school ID'),
  branchId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  licenseType: z.enum(['EDUCATIONAL', 'COMMERCIAL', 'TRIAL', 'DEMO']),
  expiresAt: z.string().datetime().optional(),
  maxDevices: z.number().min(1).max(100).default(1),
  features: z.object({
    studentManagement: z.boolean().default(true),
    teacherManagement: z.boolean().default(true),
    parentPortal: z.boolean().default(true),
    financialManagement: z.boolean().default(false),
    storeManagement: z.boolean().default(false),
    reporting: z.boolean().default(true),
    offlineMode: z.boolean().default(true),
    multiBranch: z.boolean().default(false),
    customBranding: z.boolean().default(false),
    apiAccess: z.boolean().default(false),
  }),
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

    // Check if user has permission to create licenses
    if (!session.user.permissions.includes('licenses:write')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Insufficient permissions',
      }, { status: 403 })
    }

    const body = await request.json()
    const { schoolId, branchId, userId, licenseType, expiresAt, maxDevices, features } = createLicenseSchema.parse(body)

    // Check if user can create license for this school
    if (session.user.schoolId !== schoolId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot create license for different school',
      }, { status: 403 })
    }

    // Check if user can create license for this branch
    if (session.user.branchId && branchId && session.user.branchId !== branchId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot create license for different branch',
      }, { status: 403 })
    }

    // Verify school exists and is active
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school || !school.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'School not found or inactive',
      }, { status: 404 })
    }

    // Verify branch exists and is active (if specified)
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
      })

      if (!branch || !branch.isActive || branch.schoolId !== schoolId) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Branch not found, inactive, or does not belong to school',
        }, { status: 404 })
      }
    }

    // Verify user exists and is active (if specified)
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || !user.isActive || user.schoolId !== schoolId) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'User not found, inactive, or does not belong to school',
        }, { status: 404 })
      }
    }

    // Convert features to array
    const featureArray = Object.entries(features)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => feature.replace(/([A-Z])/g, '_$1').toLowerCase())

    // Generate license key
    const licenseKey = licenseManager.generateLicenseKey(schoolId, branchId, features)

    // Create license
    const license = await prisma.license.create({
      data: {
        schoolId,
        branchId,
        userId,
        licenseKey,
        licenseType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxDevices,
        features: featureArray,
        isOfflineMode: features.offlineMode,
        createdBy: session.user.id,
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId,
        branchId,
        userId: session.user.id,
        licenseId: license.id,
        action: 'LICENSE_CREATED',
        resource: 'LICENSE',
        resourceId: license.id,
        details: JSON.stringify({
          licenseType,
          maxDevices,
          features: featureArray,
          expiresAt: license.expiresAt,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<License>>({
      success: true,
      data: license,
      message: 'License created successfully',
    })

  } catch (error) {
    console.error('Create license error:', error)
    
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