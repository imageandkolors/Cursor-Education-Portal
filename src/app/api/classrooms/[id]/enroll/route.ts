import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse } from '@/types'
import { z } from 'zod'

const enrollSchema = z.object({
  studentId: z.string().uuid().optional(),
  code: z.string().optional(),
})

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
    const { studentId, code } = enrollSchema.parse(body)

    // Find classroom
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        enrollments: {
          where: { isActive: true },
        },
      },
    })

    if (!classroom || !classroom.isActive) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Classroom not found or inactive',
      }, { status: 404 })
    }

    // Check if classroom is full
    if (classroom.currentStudents >= classroom.maxStudents) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Classroom is full',
      }, { status: 400 })
    }

    let targetStudentId = studentId

    // If enrolling by code, find student by code or use current user
    if (code) {
      if (code !== classroom.code) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid classroom code',
        }, { status: 400 })
      }
      targetStudentId = session.user.id
    }

    // If no studentId provided, use current user
    if (!targetStudentId) {
      targetStudentId = session.user.id
    }

    // Check if user can enroll this student
    if (targetStudentId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'TEACHER') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot enroll other students',
      }, { status: 403 })
    }

    // Verify student exists and belongs to same school
    const student = await prisma.user.findUnique({
      where: { id: targetStudentId },
    })

    if (!student || !student.isActive || student.schoolId !== classroom.schoolId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Student not found or not in same school',
      }, { status: 404 })
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.classroomEnrollment.findUnique({
      where: {
        classroomId_studentId: {
          classroomId,
          studentId: targetStudentId,
        },
      },
    })

    if (existingEnrollment) {
      if (existingEnrollment.isActive) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Student is already enrolled in this classroom',
        }, { status: 400 })
      } else {
        // Reactivate enrollment
        await prisma.classroomEnrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            isActive: true,
            enrolledBy: session.user.id,
            enrolledAt: new Date(),
          },
        })
      }
    } else {
      // Create new enrollment
      await prisma.classroomEnrollment.create({
        data: {
          classroomId,
          studentId: targetStudentId,
          enrolledBy: session.user.id,
        },
      })
    }

    // Update classroom student count
    await prisma.classroom.update({
      where: { id: classroomId },
      data: {
        currentStudents: {
          increment: 1,
        },
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'STUDENT_ENROLLED',
        resource: 'CLASSROOM',
        resourceId: classroomId,
        details: JSON.stringify({
          studentId: targetStudentId,
          classroomCode: classroom.code,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Student enrolled successfully',
    })

  } catch (error) {
    console.error('Enroll student error:', error)
    
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