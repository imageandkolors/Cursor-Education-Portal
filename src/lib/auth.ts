import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { AuthUser, UserRole } from '@/types'

const secretKey = process.env.JWT_SECRET!
const key = new TextEncoder().encode(secretKey)

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key)
}

export async function decrypt(input: string) {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  })
  return payload
}

export async function createSession(user: AuthUser) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  const session = await encrypt({ user, expires })

  cookies().set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires,
    sameSite: 'lax',
    path: '/',
  })
}

export async function getSession(): Promise<{ user: AuthUser; expires: Date } | null> {
  const session = cookies().get('session')?.value
  if (!session) return null

  try {
    const payload = await decrypt(session)
    return payload as { user: AuthUser; expires: Date }
  } catch (error) {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  if (!session) return

  try {
    const payload = await decrypt(session)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const newSession = await encrypt({ ...payload, expires })

    request.cookies.set('session', newSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires,
      sameSite: 'lax',
      path: '/',
    })
  } catch (error) {
    // Session is invalid, will be cleared
  }
}

export async function deleteSession() {
  cookies().delete('session')
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return user.permissions.includes(permission) || user.role === 'ADMIN'
}

export function hasRole(user: AuthUser, roles: UserRole[]): boolean {
  return roles.includes(user.role)
}

export function canAccessBranch(user: AuthUser, branchId: string): boolean {
  if (user.role === 'ADMIN') return true
  return user.branchId === branchId
}

export function getRolePermissions(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    ADMIN: [
      'users:read', 'users:write', 'users:delete',
      'schools:read', 'schools:write', 'schools:delete',
      'branches:read', 'branches:write', 'branches:delete',
      'licenses:read', 'licenses:write', 'licenses:delete',
      'settings:read', 'settings:write',
      'audit:read', 'notifications:read', 'notifications:write'
    ],
    TEACHER: [
      'students:read', 'students:write',
      'classes:read', 'classes:write',
      'assignments:read', 'assignments:write',
      'grades:read', 'grades:write',
      'notifications:read'
    ],
    STUDENT: [
      'profile:read', 'profile:write',
      'classes:read', 'assignments:read',
      'grades:read', 'notifications:read'
    ],
    PARENT: [
      'children:read', 'children:grades:read',
      'notifications:read'
    ],
    BURSAR: [
      'financial:read', 'financial:write',
      'fees:read', 'fees:write',
      'payments:read', 'payments:write',
      'reports:read', 'notifications:read'
    ],
    STORE_MANAGER: [
      'inventory:read', 'inventory:write',
      'products:read', 'products:write',
      'sales:read', 'sales:write',
      'reports:read', 'notifications:read'
    ]
  }

  return permissions[role] || []
}