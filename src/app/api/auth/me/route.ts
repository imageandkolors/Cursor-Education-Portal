import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ApiResponse, AuthUser } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Not authenticated',
      }, { status: 401 })
    }

    return NextResponse.json<ApiResponse<AuthUser>>({
      success: true,
      data: session.user,
    })

  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error',
    }, { status: 500 })
  }
}