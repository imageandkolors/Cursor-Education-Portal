import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, EReceipt } from '@/types'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import PDFDocument from 'pdfkit'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const generateEReceiptSchema = z.object({
  expiresInDays: z.number().min(1).max(365).default(30),
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
    const { expiresInDays } = generateEReceiptSchema.parse(body)

    // Verify payment exists and is verified
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            username: true,
          },
        },
        feeStructure: {
          select: {
            name: true,
            feeType: true,
            term: true,
            session: true,
            dueDate: true,
          },
        },
        school: {
          select: {
            name: true,
            code: true,
            address: true,
            phone: true,
            email: true,
          },
        },
        branch: {
          select: {
            name: true,
            code: true,
            address: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment not found',
      }, { status: 404 })
    }

    if (payment.status !== 'VERIFIED') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Payment must be verified before generating e-receipt',
      }, { status: 400 })
    }

    // Check if e-receipt already exists
    const existingEReceipt = await prisma.eReceipt.findFirst({
      where: { paymentId },
    })

    if (existingEReceipt && new Date(existingEReceipt.expiresAt) > new Date()) {
      return NextResponse.json<ApiResponse<EReceipt>>({
        success: true,
        data: existingEReceipt as EReceipt,
        message: 'E-receipt already exists',
      })
    }

    // Generate receipt number
    const receiptNumber = `REC-${payment.school.code}-${payment.branch?.code || 'MAIN'}-${Date.now().toString().slice(-8)}`

    // Generate QR code
    const qrData = JSON.stringify({
      receiptNumber,
      paymentId,
      studentId: payment.studentId,
      amount: payment.amount.toString(),
      date: payment.paidAt?.toISOString(),
      school: payment.school.code,
      branch: payment.branch?.code || 'MAIN',
    })

    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })

    // Generate watermark
    const watermark = `SMARTEDU360 - ${payment.school.name} - ${new Date().toISOString()}`

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const pdfPath = join(process.cwd(), 'uploads', 'e-receipts', `${receiptNumber}.pdf`)
    
    // Create directory if it doesn't exist
    await mkdir(join(process.cwd(), 'uploads', 'e-receipts'), { recursive: true })

    // Add content to PDF
    doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' })
    doc.fontSize(12).text(`Receipt No: ${receiptNumber}`, { align: 'center' })
    doc.moveDown()

    // School information
    doc.fontSize(14).text('School Information:', { underline: true })
    doc.fontSize(12).text(`School: ${payment.school.name}`)
    doc.text(`Code: ${payment.school.code}`)
    if (payment.branch) {
      doc.text(`Branch: ${payment.branch.name}`)
      doc.text(`Branch Code: ${payment.branch.code}`)
    }
    doc.text(`Address: ${payment.school.address || 'N/A'}`)
    doc.text(`Phone: ${payment.school.phone || 'N/A'}`)
    doc.text(`Email: ${payment.school.email || 'N/A'}`)
    doc.moveDown()

    // Student information
    doc.fontSize(14).text('Student Information:', { underline: true })
    doc.fontSize(12).text(`Name: ${payment.student.firstName} ${payment.student.lastName}`)
    doc.text(`Email: ${payment.student.email}`)
    doc.text(`Username: ${payment.student.username}`)
    doc.moveDown()

    // Payment information
    doc.fontSize(14).text('Payment Information:', { underline: true })
    doc.fontSize(12).text(`Fee: ${payment.feeStructure.name}`)
    doc.text(`Type: ${payment.feeStructure.feeType}`)
    doc.text(`Term: ${payment.feeStructure.term}`)
    doc.text(`Session: ${payment.feeStructure.session}`)
    doc.text(`Amount: ₦${payment.amount.toFixed(2)}`)
    doc.text(`Payment Method: ${payment.paymentMethod}`)
    doc.text(`Payment Date: ${payment.paidAt?.toLocaleDateString() || 'N/A'}`)
    doc.text(`Verified By: ${payment.verifiedBy || 'System'}`)
    doc.moveDown()

    // Add QR code
    doc.text('Verification QR Code:', { underline: true })
    doc.image(Buffer.from(qrCodeDataURL.split(',')[1], 'base64'), 50, doc.y, { width: 150, height: 150 })
    doc.moveDown()

    // Add watermark
    doc.fontSize(8).text(watermark, { align: 'center', opacity: 0.3 })
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' })
    doc.text(`Valid until: ${new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toLocaleString()}`, { align: 'center' })

    // Save PDF
    const stream = require('fs').createWriteStream(pdfPath)
    doc.pipe(stream)
    doc.end()

    // Wait for PDF to be written
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve)
      stream.on('error', reject)
    })

    // Create e-receipt record
    const eReceipt = await prisma.eReceipt.create({
      data: {
        paymentId,
        studentId: payment.studentId,
        receiptNumber,
        qrCode: qrCodeDataURL,
        watermark,
        pdfPath,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'E_RECEIPT_GENERATED',
        resource: 'E_RECEIPT',
        resourceId: eReceipt.id,
        details: JSON.stringify({
          paymentId,
          receiptNumber,
          expiresInDays,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<EReceipt>>({
      success: true,
      data: eReceipt as EReceipt,
      message: 'E-receipt generated successfully',
    })

  } catch (error) {
    console.error('Generate e-receipt error:', error)
    
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
        error: 'Cannot view e-receipt for this payment',
      }, { status: 403 })
    }

    const eReceipt = await prisma.eReceipt.findFirst({
      where: { 
        paymentId,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!eReceipt) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'E-receipt not found or expired',
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<EReceipt>>({
      success: true,
      data: eReceipt as EReceipt,
    })

  } catch (error) {
    console.error('Get e-receipt error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}