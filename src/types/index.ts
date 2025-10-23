import { UserRole, LicenseType, LicenseStatus, NotificationType, MaterialType, AttendanceStatus, ExamType, QuestionType, DifficultyLevel, AttemptStatus, SubmissionStatus } from '@prisma/client'

export type { UserRole, LicenseType, LicenseStatus, NotificationType, MaterialType, AttendanceStatus, ExamType, QuestionType, DifficultyLevel, AttemptStatus, SubmissionStatus }

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

export interface Classroom {
  id: string
  schoolId: string
  branchId?: string
  teacherId: string
  name: string
  code: string
  description?: string
  subject: string
  grade?: string
  isActive: boolean
  isPublic: boolean
  maxStudents: number
  currentStudents: number
  createdAt: Date
  updatedAt: Date
  teacher?: {
    firstName: string
    lastName: string
    email: string
  }
  school?: {
    name: string
    code: string
  }
  branch?: {
    name: string
    code: string
  }
  _count?: {
    enrollments: number
    materials: number
    discussions: number
  }
}

export interface ClassroomMaterial {
  id: string
  classroomId: string
  title: string
  description?: string
  type: MaterialType
  url?: string
  filePath?: string
  fileSize?: number
  mimeType?: string
  isRequired: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface ClassroomDiscussion {
  id: string
  classroomId: string
  userId: string
  title: string
  content: string
  isPinned: boolean
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
  user?: {
    firstName: string
    lastName: string
    email: string
  }
  replies?: DiscussionReply[]
}

export interface DiscussionReply {
  id: string
  discussionId: string
  userId: string
  content: string
  createdAt: Date
  updatedAt: Date
  user?: {
    firstName: string
    lastName: string
    email: string
  }
}

export interface ClassroomAttendance {
  id: string
  classroomId: string
  studentId: string
  date: Date
  status: AttendanceStatus
  checkInTime?: Date
  checkOutTime?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface Exam {
  id: string
  classroomId: string
  teacherId: string
  title: string
  description?: string
  type: ExamType
  duration: number
  totalMarks: number
  passingMarks: number
  startDate: Date
  endDate: Date
  isActive: boolean
  isPublished: boolean
  allowRetake: boolean
  maxAttempts: number
  createdAt: Date
  updatedAt: Date
  classroom?: {
    name: string
    code: string
    subject: string
  }
  teacher?: {
    firstName: string
    lastName: string
    email: string
  }
  _count?: {
    questions: number
    attempts: number
    tokens: number
  }
}

export interface ExamToken {
  id: string
  examId: string
  token: string
  studentId?: string
  isUsed: boolean
  usedAt?: Date
  expiresAt?: Date
  createdAt: Date
  createdBy: string
  student?: {
    firstName: string
    lastName: string
    email: string
  }
}

export interface Question {
  id: string
  examId: string
  schoolId: string
  branchId?: string
  classroomId: string
  subject: string
  term: string
  teacherId: string
  question: string
  type: QuestionType
  options: string[]
  correctAnswer?: string
  explanation?: string
  marks: number
  difficulty: DifficultyLevel
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
  exam?: {
    title: string
    type: ExamType
  }
  classroom?: {
    name: string
    subject: string
  }
  teacher?: {
    firstName: string
    lastName: string
  }
}

export interface Answer {
  id: string
  questionId: string
  studentId: string
  answer: string
  isCorrect?: boolean
  marksObtained?: number
  timeSpent?: number
  createdAt: Date
}

export interface ExamAttempt {
  id: string
  examId: string
  studentId: string
  token: string
  startTime: Date
  endTime?: Date
  submittedAt?: Date
  totalMarks: number
  marksObtained: number
  percentage: number
  status: AttemptStatus
  isOffline: boolean
  syncedAt?: Date
  deviceInfo?: string
  cheatAttempts: number
  tabSwitches: number
  createdAt: Date
  updatedAt: Date
  exam?: {
    id: string
    title: string
    duration: number
    totalMarks: number
    passingMarks: number
    startDate: Date
    endDate: Date
    isActive: boolean
    isPublished: boolean
    allowRetake: boolean
    maxAttempts: number
    createdAt: Date
    updatedAt: Date
    classroomId: string
    teacherId: string
    type: ExamType
  }
  questions?: Question[]
}

export interface Assignment {
  id: string
  classroomId: string
  teacherId: string
  title: string
  description: string
  instructions?: string
  dueDate: Date
  totalMarks: number
  isActive: boolean
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AssignmentSubmission {
  id: string
  assignmentId: string
  studentId: string
  content: string
  filePath?: string
  marksObtained?: number
  feedback?: string
  submittedAt: Date
  gradedAt?: Date
  status: SubmissionStatus
}