import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, Receipt } from '@/types'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

const uploadReceiptSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().min(1, 'File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
  fileData: z.string().min(1, 'File data is required'),
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

    const { id: paymentId } = params
    const body = await request.json()
    const { fileName, fileSize, mimeType, fileData } = uploadReceiptSchema.parse(body)

    // Verify payment exists and belongs to user or user has permission
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        feeStructure: true,
      },
    })

    if (!payment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment not found',
      }, { status: 404 })
    }

    // Check access permissions
    const canUpload = payment.studentId === session.user.id || 
                     session.user.permissions.includes('financial:write') ||
                     session.user.role === 'ADMIN'

    if (!canUpload) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot upload receipt for this payment',
      }, { status: 403 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid file type. Only images and PDFs are allowed',
      }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (fileSize > maxSize) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'File size too large. Maximum 10MB allowed',
      }, { status: 400 })
    }

    // Generate unique filename
    const fileExtension = fileName.split('.').pop()
    const uniqueFileName = `${uuidv4()}.${fileExtension}`
    const filePath = join(process.cwd(), 'uploads', 'receipts', uniqueFileName)

    // Create directory if it doesn't exist
    await mkdir(join(process.cwd(), 'uploads', 'receipts'), { recursive: true })

    // Save file
    const buffer = Buffer.from(fileData, 'base64')
    await writeFile(filePath, buffer)

    // Create receipt record
    const receipt = await prisma.receipt.create({
      data: {
        paymentId,
        feeStructureId: payment.feeStructureId,
        studentId: payment.studentId,
        fileName,
        filePath,
        fileSize,
        mimeType,
        status: 'PENDING',
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'RECEIPT_UPLOADED',
        resource: 'RECEIPT',
        resourceId: receipt.id,
        details: JSON.stringify({
          paymentId,
          fileName,
          fileSize,
          mimeType,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<Receipt>>({
      success: true,
      data: receipt as Receipt,
      message: 'Receipt uploaded successfully',
    })

  } catch (error) {
    console.error('Upload receipt error:', error)
    
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

    const { id: paymentId } = params

    // Verify payment exists and user has access
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    })

    if (!payment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment not found',
      }, { status: 404 })
    }

    // Check access permissions
    const canView = payment.studentId === session.user.id || 
                   session.user.permissions.includes('financial:read') ||
                   session.user.role === 'ADMIN'

    if (!canView) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Cannot view receipts for this payment',
      }, { status: 403 })
    }

    const receipts = await prisma.receipt.findMany({
      where: { paymentId },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json<ApiResponse<Receipt[]>>({
      success: true,
      data: receipts as Receipt[],
    })

  } catch (error) {
    console.error('List receipts error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}