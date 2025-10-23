import { licenseManager } from './license'
import { License, LicenseVerification } from '@/types'

export class OfflineManager {
  private static instance: OfflineManager
  private isOnline: boolean = true
  private syncQueue: Array<() => Promise<void>> = []

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager()
    }
    return OfflineManager.instance
  }

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      this.isOnline = true
      this.processSyncQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  async isDeviceOnline(): Promise<boolean> {
    if (typeof window === 'undefined') return true
    return navigator.onLine
  }

  async verifyLicenseOffline(licenseKey: string, schoolId: string, branchId?: string): Promise<LicenseVerification> {
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

  async syncWhenOnline(syncFunction: () => Promise<void>): Promise<void> {
    if (await this.isDeviceOnline()) {
      try {
        await syncFunction()
      } catch (error) {
        console.error('Sync failed:', error)
        this.addToSyncQueue(syncFunction)
      }
    } else {
      this.addToSyncQueue(syncFunction)
    }
  }

  private addToSyncQueue(syncFunction: () => Promise<void>): void {
    this.syncQueue.push(syncFunction)
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return

    const queue = [...this.syncQueue]
    this.syncQueue = []

    for (const syncFunction of queue) {
      try {
        await syncFunction()
      } catch (error) {
        console.error('Sync failed:', error)
        // Re-add to queue if sync fails
        this.syncQueue.push(syncFunction)
      }
    }
  }

  async cacheData(key: string, data: any): Promise<void> {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.error('Failed to cache data:', error)
    }
  }

  async getCachedData(key: string, maxAge: number = 24 * 60 * 60 * 1000): Promise<any | null> {
    if (typeof window === 'undefined') return null
    
    try {
      const cached = localStorage.getItem(`cache_${key}`)
      if (!cached) return null

      const { data, timestamp } = JSON.parse(cached)
      
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(`cache_${key}`)
        return null
      }

      return data
    } catch {
      return null
    }
  }

  async clearCache(): Promise<void> {
    if (typeof window === 'undefined') return
    
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('cache_') || key.startsWith('license_')) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  async getStorageUsage(): Promise<{ used: number; available: number }> {
    if (typeof window === 'undefined') return { used: 0, available: 0 }
    
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0
        }
      }
    } catch (error) {
      console.error('Failed to get storage usage:', error)
    }
    
    return { used: 0, available: 0 }
  }
}

export const offlineManager = OfflineManager.getInstance()