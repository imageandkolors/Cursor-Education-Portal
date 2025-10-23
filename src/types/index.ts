import { UserRole, LicenseType, LicenseStatus, NotificationType } from '@prisma/client'

export type { UserRole, LicenseType, LicenseStatus, NotificationType }

export interface User {
  id: string
  schoolId: string
  branchId?: string
  email: string
  username: string
  firstName: string
  lastName: string
  phone?: string
  role: UserRole
  isActive: boolean
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface School {
  id: string
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  website?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface Branch {
  id: string
  schoolId: string
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface License {
  id: string
  schoolId: string
  branchId?: string
  userId?: string
  licenseKey: string
  deviceId?: string
  deviceName?: string
  licenseType: LicenseType
  status: LicenseStatus
  expiresAt?: Date
  maxDevices: number
  usedDevices: number
  features: string[]
  isOfflineMode: boolean
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface LicenseVerification {
  isValid: boolean
  license?: License
  error?: string
  offlineMode?: boolean
}

export interface AuthUser {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  role: UserRole
  schoolId: string
  branchId?: string
  permissions: string[]
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface LicenseFeatures {
  studentManagement: boolean
  teacherManagement: boolean
  parentPortal: boolean
  financialManagement: boolean
  storeManagement: boolean
  reporting: boolean
  offlineMode: boolean
  multiBranch: boolean
  customBranding: boolean
  apiAccess: boolean
}

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  platform: 'web' | 'android' | 'ios' | 'desktop'
  version: string
  lastSeen: Date
}

export interface Notification {
  id: string
  schoolId: string
  branchId?: string
  userId?: string
  title: string
  message: string
  type: NotificationType
  isRead: boolean
  isGlobal: boolean
  expiresAt?: Date
  createdAt: Date
  createdBy?: string
}

export interface AuditLog {
  id: string
  schoolId: string
  branchId?: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface SchoolSettings {
  id: string
  schoolId: string
  key: string
  value: string
  description?: string
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

export interface BranchSettings {
  id: string
  branchId: string
  key: string
  value: string
  description?: string
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}