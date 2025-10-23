import CryptoJS from 'crypto-js'
import { v4 as uuidv4 } from 'uuid'
import { License, LicenseVerification, LicenseFeatures, DeviceInfo } from '@/types'

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'default-secret-key'

export class LicenseManager {
  private static instance: LicenseManager
  private deviceInfo: DeviceInfo | null = null

  static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager()
    }
    return LicenseManager.instance
  }

  async generateDeviceId(): Promise<string> {
    if (this.deviceInfo?.deviceId) {
      return this.deviceInfo.deviceId
    }

    // Generate a unique device ID based on various factors
    const canvas = typeof window !== 'undefined' ? document.createElement('canvas') : null
    const ctx = canvas?.getContext('2d')
    const fingerprint = ctx ? ctx.canvas.toDataURL() : 'web'
    
    const deviceId = CryptoJS.SHA256(
      `${navigator.userAgent}-${screen.width}x${screen.height}-${fingerprint}-${Date.now()}`
    ).toString()

    this.deviceInfo = {
      deviceId,
      deviceName: this.getDeviceName(),
      platform: this.getPlatform(),
      version: '1.0.0',
      lastSeen: new Date()
    }

    return deviceId
  }

  private getDeviceName(): string {
    if (typeof window === 'undefined') return 'Server'
    
    const userAgent = navigator.userAgent
    if (userAgent.includes('Android')) return 'Android Device'
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS Device'
    if (userAgent.includes('Windows')) return 'Windows PC'
    if (userAgent.includes('Mac')) return 'Mac'
    if (userAgent.includes('Linux')) return 'Linux PC'
    return 'Unknown Device'
  }

  private getPlatform(): 'web' | 'android' | 'ios' | 'desktop' {
    if (typeof window === 'undefined') return 'web'
    
    const userAgent = navigator.userAgent
    if (userAgent.includes('Android')) return 'android'
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios'
    return 'web'
  }

  generateLicenseKey(schoolId: string, branchId?: string, features: LicenseFeatures = {}): string {
    const payload = {
      schoolId,
      branchId,
      features,
      timestamp: Date.now(),
      uuid: uuidv4()
    }

    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(payload),
      LICENSE_SECRET
    ).toString()

    return CryptoJS.SHA256(encrypted).toString().substring(0, 32).toUpperCase()
  }

  async verifyLicense(licenseKey: string, schoolId: string, branchId?: string): Promise<LicenseVerification> {
    try {
      // First try online verification
      const onlineVerification = await this.verifyOnline(licenseKey, schoolId, branchId)
      if (onlineVerification.isValid) {
        return onlineVerification
      }

      // Fallback to offline verification
      return await this.verifyOffline(licenseKey, schoolId, branchId)
    } catch (error) {
      console.error('License verification error:', error)
      return {
        isValid: false,
        error: 'License verification failed'
      }
    }
  }

  private async verifyOnline(licenseKey: string, schoolId: string, branchId?: string): Promise<LicenseVerification> {
    try {
      const response = await fetch('/api/license/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey,
          schoolId,
          branchId,
          deviceId: await this.generateDeviceId(),
          deviceInfo: this.deviceInfo
        })
      })

      const result = await response.json()
      
      if (result.success && result.data) {
        return {
          isValid: true,
          license: result.data,
          offlineMode: false
        }
      }

      return {
        isValid: false,
        error: result.error || 'License verification failed'
      }
    } catch (error) {
      throw new Error('Online verification failed')
    }
  }

  private async verifyOffline(licenseKey: string, schoolId: string, branchId?: string): Promise<LicenseVerification> {
    try {
      // Check if we have cached license data
      const cachedLicense = this.getCachedLicense(licenseKey)
      if (cachedLicense && this.isLicenseValidOffline(cachedLicense)) {
        return {
          isValid: true,
          license: cachedLicense,
          offlineMode: true
        }
      }

      return {
        isValid: false,
        error: 'No valid offline license found',
        offlineMode: true
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Offline verification failed',
        offlineMode: true
      }
    }
  }

  private getCachedLicense(licenseKey: string): License | null {
    if (typeof window === 'undefined') return null
    
    try {
      const cached = localStorage.getItem(`license_${licenseKey}`)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  }

  private setCachedLicense(license: License): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(`license_${license.licenseKey}`, JSON.stringify(license))
    } catch (error) {
      console.error('Failed to cache license:', error)
    }
  }

  private isLicenseValidOffline(license: License): boolean {
    if (license.status !== 'ACTIVE') return false
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) return false
    if (!license.isOfflineMode) return false
    
    // Check if license was synced recently (within 7 days)
    if (license.lastSyncAt) {
      const daysSinceSync = (Date.now() - new Date(license.lastSyncAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceSync > 7) return false
    }

    return true
  }

  async syncLicense(license: License): Promise<void> {
    try {
      // Update last sync time
      license.lastSyncAt = new Date()
      
      // Cache the updated license
      this.setCachedLicense(license)
      
      // Try to sync with server
      await fetch('/api/license/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: license.licenseKey,
          deviceId: await this.generateDeviceId(),
          lastSyncAt: license.lastSyncAt
        })
      })
    } catch (error) {
      console.error('License sync failed:', error)
      // Continue with offline mode
    }
  }

  async checkLicenseExpiry(license: License): Promise<boolean> {
    if (!license.expiresAt) return false
    
    const daysUntilExpiry = (new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiry <= 30 // Alert if expires within 30 days
  }

  getLicenseFeatures(license: License): LicenseFeatures {
    const features: LicenseFeatures = {
      studentManagement: license.features.includes('student_management'),
      teacherManagement: license.features.includes('teacher_management'),
      parentPortal: license.features.includes('parent_portal'),
      financialManagement: license.features.includes('financial_management'),
      storeManagement: license.features.includes('store_management'),
      reporting: license.features.includes('reporting'),
      offlineMode: license.isOfflineMode,
      multiBranch: license.features.includes('multi_branch'),
      customBranding: license.features.includes('custom_branding'),
      apiAccess: license.features.includes('api_access')
    }

    return features
  }

  async revokeLicense(licenseKey: string, reason: string): Promise<boolean> {
    try {
      const response = await fetch('/api/license/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey,
          reason
        })
      })

      const result = await response.json()
      return result.success
    } catch (error) {
      console.error('License revocation failed:', error)
      return false
    }
  }
}

export const licenseManager = LicenseManager.getInstance()