import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ApiResponse, ProductDownload } from '@/types'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import CryptoJS from 'crypto-js'
import { readFile } from 'fs/promises'
import { join } from 'path'

const downloadSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  productId: z.string().uuid('Invalid product ID'),
})

const generateDownloadLinkSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  productId: z.string().uuid('Invalid product ID'),
  expiresInHours: z.number().min(1).max(168).default(24), // Max 7 days
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

    const body = await request.json()
    const { orderId, productId, expiresInHours } = generateDownloadLinkSchema.parse(body)

    // Verify order exists and belongs to user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: { productId },
          include: {
            product: true,
          },
        },
      },
    })

    if (!order || order.studentId !== session.user.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Order not found or access denied',
      }, { status: 404 })
    }

    if (order.status !== 'DELIVERED' && order.status !== 'CONFIRMED') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Order must be delivered before downloading',
      }, { status: 400 })
    }

    const orderItem = order.items[0]
    if (!orderItem) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Product not found in order',
      }, { status: 404 })
    }

    const product = orderItem.product

    if (!product.isDigital || product.type !== 'DIGITAL') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Product is not digital',
      }, { status: 400 })
    }

    if (!product.filePath) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Digital file not available',
      }, { status: 400 })
    }

    // Check if download already exists and is still valid
    const existingDownload = await prisma.productDownload.findFirst({
      where: {
        orderId,
        productId,
        expiresAt: {
          gt: new Date(),
        },
        isUsed: false,
      },
    })

    if (existingDownload) {
      return NextResponse.json<ApiResponse<ProductDownload>>({
        success: true,
        data: existingDownload as ProductDownload,
        message: 'Download link already exists',
      })
    }

    // Generate download token
    const downloadToken = uuidv4()
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

    // Encrypt the download URL with timestamp
    const downloadData = {
      token: downloadToken,
      orderId,
      productId,
      studentId: session.user.id,
      expiresAt: expiresAt.getTime(),
      timestamp: Date.now(),
    }

    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(downloadData),
      process.env.LICENSE_SECRET || 'default-secret-key'
    ).toString()

    const downloadUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/marketplace/download/${encryptedData}`

    // Create download record
    const productDownload = await prisma.productDownload.create({
      data: {
        productId,
        orderId,
        studentId: session.user.id,
        downloadToken,
        downloadUrl,
        expiresAt,
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    // Log audit
    await prisma.auditLog.create({
      data: {
        schoolId: session.user.schoolId,
        branchId: session.user.branchId,
        userId: session.user.id,
        action: 'DOWNLOAD_LINK_GENERATED',
        resource: 'PRODUCT_DOWNLOAD',
        resourceId: productDownload.id,
        details: JSON.stringify({
          orderId,
          productId,
          expiresInHours,
        }),
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json<ApiResponse<ProductDownload>>({
      success: true,
      data: productDownload as ProductDownload,
      message: 'Download link generated successfully',
    })

  } catch (error) {
    console.error('Generate download link error:', error)
    
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
  { params }: { params: { encryptedData: string } }
) {
  try {
    const { encryptedData } = params

    // Decrypt the download data
    let downloadData: any
    try {
      const decryptedBytes = CryptoJS.AES.decrypt(
        encryptedData,
        process.env.LICENSE_SECRET || 'default-secret-key'
      )
      downloadData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8))
    } catch (error) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid download link',
      }, { status: 400 })
    }

    // Verify download data
    const { token, orderId, productId, studentId, expiresAt, timestamp } = downloadData

    if (!token || !orderId || !productId || !studentId || !expiresAt || !timestamp) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid download data',
      }, { status: 400 })
    }

    // Check if link has expired
    if (Date.now() > expiresAt) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Download link has expired',
      }, { status: 400 })
    }

    // Verify download record exists and is valid
    const download = await prisma.productDownload.findFirst({
      where: {
        downloadToken: token,
        orderId,
        productId,
        studentId,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        product: true,
        order: true,
      },
    })

    if (!download) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Download link not found or expired',
      }, { status: 404 })
    }

    // Check if download limit exceeded
    if (download.product.downloadLimit) {
      const downloadCount = await prisma.productDownload.count({
        where: {
          orderId,
          productId,
          isUsed: true,
        },
      })

      if (downloadCount >= download.product.downloadLimit) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Download limit exceeded',
        }, { status: 400 })
      }
    }

    // Mark download as used
    await prisma.productDownload.update({
      where: { id: download.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    })

    // Read the file
    try {
      const filePath = join(process.cwd(), download.product.filePath!)
      const fileBuffer = await readFile(filePath)

      // Set appropriate headers
      const headers = new Headers()
      headers.set('Content-Type', download.product.mimeType || 'application/octet-stream')
      headers.set('Content-Disposition', `attachment; filename="${download.product.name}"`)
      headers.set('Content-Length', fileBuffer.length.toString())

      return new NextResponse(fileBuffer, {
        status: 200,
        headers,
      })
    } catch (error) {
      console.error('File read error:', error)
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'File not found or inaccessible',
      }, { status: 404 })
    }

  } catch (error) {
    console.error('Download file error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}