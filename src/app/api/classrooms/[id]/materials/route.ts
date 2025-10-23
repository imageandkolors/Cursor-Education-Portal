import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, ClassroomMaterial } from '@/types'
import { z } from 'zod'

const createMaterialSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(['PDF', 'AUDIO', 'VIDEO', 'DOCUMENT', 'IMAGE', 'LINK']),
  url: z.string().url().optional(),
  filePath: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().default(0),
})

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

    const { id: classroomId } = params

    // Verify classroom access
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
    })

    if (!classroom || !classroom.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Classroom not found or inactive',
      }, { status: 404 })
    }

    // Check access permissions
    const hasAccess = await checkClassroomAccess(session.user.id, classroomId, session.user.role)
    if (!hasAccess) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Access denied to this classroom',
      }, { status: 403 })
    }

    const materials = await prisma.classroomMaterial.findMany({
      where: { classroomId },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    return NextResponse.json<ApiResponse<ClassroomMaterial[]>>({
      success: true,
      data: materials as ClassroomMaterial[],
    })

  } catch (error) {
    console.error('List materials error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}

export async function POST(
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

    const { id: classroomId } = params
    const body = await request.json()
    const { title, description, type, url, filePath, fileSize, mimeType, isRequired, order } = createMaterialSchema.parse(body)

    // Verify classroom access and teacher permissions
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
    })

    if (!classroom || !classroom.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Classroom not found or inactive',
      }, { status: 404 })
    }

    // Check if user is the teacher or admin
    if (classroom.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Only the teacher can add materials',
      }, { status: 403 })
    }

    // Validate material type and required fields
    if (type === 'LINK' && !url) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'URL is required for link materials',
      }, { status: 400 })
    }

    if (type !== 'LINK' && !filePath) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'File path is required for file materials',
      }, { status: 400 })
    }

    const material = await prisma.classroomMaterial.create({
      data: {
        classroomId,
        title,
        description,
        type,
        url,
        filePath,
        fileSize,
        mimeType,
        isRequired,
        order,
        createdBy: session.user.id,
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'MATERIAL_ADDED',
        resource: 'CLASSROOM_MATERIAL',
        resourceId: material.id,
        details: JSON.stringify({
          title,
          type,
          classroomId,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<ClassroomMaterial>>({
      success: true,
      data: material as ClassroomMaterial,
      message: 'Material added successfully',
    })

  } catch (error) {
    console.error('Create material error:', error)
    
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

async function checkClassroomAccess(userId: string, classroomId: string, userRole: string): Promise<boolean> {
  if (userRole === 'ADMIN') return true

  // Check if user is the teacher
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { teacherId: true },
  })

  if (classroom?.teacherId === userId) return true

  // Check if user is enrolled as student
  const enrollment = await prisma.classroomEnrollment.findUnique({
    where: {
      classroomId_studentId: {
        classroomId,
        studentId: userId,
      },
    },
  })

  return enrollment?.isActive || false
}