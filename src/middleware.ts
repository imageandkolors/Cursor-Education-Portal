import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public routes
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/api/auth/login',
    '/api/auth/register',
    '/api/license/verify',
    '/_next',
    '/favicon.ico',
  ]

  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Update session if it exists
  await updateSession(request)

  // Get session
  const session = await getSession()
  
  if (!session) {
    // Redirect to login if not authenticated
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Check license verification for protected routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
    // Skip license check for license verification endpoints
    if (pathname.startsWith('/api/license/verify') || pathname.startsWith('/api/license/sync')) {
      return NextResponse.next()
    }

    // Add license verification logic here if needed
    // For now, we'll just continue with the request
  }

  // Check role-based access
  if (pathname.startsWith('/admin') && session.user.role !== 'ADMIN') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}