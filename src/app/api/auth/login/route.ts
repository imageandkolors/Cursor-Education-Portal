import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createSession, getRolePermissions } from '@/lib/auth'
import { ApiResponse, AuthUser } from '@/types'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        school: true,
        branch: true,
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid credentials',
      }, { status: 401 })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid credentials',
      }, { status: 401 })
    }

    // Check if school is active
    if (!user.school.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'School account is inactive',
      }, { status: 403 })
    }

    // Check if branch is active (if user belongs to a branch)
    if (user.branchId && !user.branch?.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Branch account is inactive',
      }, { status: 403 })
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    // Create auth user object
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      schoolId: user.schoolId,
      branchId: user.branchId || undefined,
      permissions: getRolePermissions(user.role),
    }

    // Create session
    await createSession(authUser)

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: user.schoolId,
        branchId: user.branchId,
        userId: user.id,
        action: 'LOGIN',
        resource: 'USER',
        resourceId: user.id,
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<AuthUser>>({
      success: true,
      data: authUser,
      message: 'Login successful',
    })

  } catch (error) {
    console.error('Login error:', error)
    
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