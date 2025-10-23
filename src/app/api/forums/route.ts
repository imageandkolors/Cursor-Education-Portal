import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Forum } from '@/types'
import { z } from 'zod'

const createForumSchema = z.object({
  name: z.string().min(1, 'Forum name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean().default(true),
  moderatorIds: z.array(z.string().uuid()).optional(),
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
    const status = searchParams.get('status')
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

    if (status) {
      where.status = status
    }

    // Filter forums based on user role and access
    if (session.user.role === 'STUDENT' || session.user.role === 'PARENT') {
      where.isPublic = true
      where.status = 'ACTIVE'
    }

    const forums = await prisma.forum.findMany({
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
        creator: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        approver: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        moderators: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<Forum[]>>({
      success: true,
      data: forums as Forum[],
    })

  } catch (error) {
    console.error('List forums error:', error)
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

    // Only teachers and admins can create forums
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only teachers and admins can create forums',
      }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, category, isPublic, moderatorIds } = createForumSchema.parse(body)

    // Check if forum name already exists in the same school/branch
    const existingForum = await prisma.forum.findFirst({
      where: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        name,
      },
    })

    if (existingForum) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Forum with this name already exists',
      }, { status: 400 })
    }

    // Create forum
    const forum = await prisma.forum.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        name,
        description,
        category,
        isPublic,
        createdBy: session.user.id,
        // Auto-approve if created by admin
        approvedBy: session.user.role === 'ADMIN' ? session.user.id : null,
        approvedAt: session.user.role === 'ADMIN' ? new Date() : null,
        status: session.user.role === 'ADMIN' ? 'ACTIVE' : 'PENDING',
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
        creator: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        approver: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            posts: true,
          },
        },
      },
    })

    // Add moderators if provided
    if (moderatorIds && moderatorIds.length > 0) {
      await prisma.forumModerator.createMany({
        data: moderatorIds.map(moderatorId => ({
          forumId: forum.id,
          userId: moderatorId,
        })),
      })
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'FORUM_CREATED',
        resource: 'FORUM',
        resourceId: forum.id,
        details: JSON.stringify({
          name,
          category,
          isPublic,
          moderatorCount: moderatorIds?.length || 0,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Forum>>({
      success: true,
      data: forum as Forum,
      message: session.user.role === 'ADMIN' 
        ? 'Forum created and approved successfully' 
        : 'Forum created successfully. Awaiting admin approval.',
    })

  } catch (error) {
    console.error('Create forum error:', error)
    
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