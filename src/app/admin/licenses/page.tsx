'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonText, IonButton, IonSpinner, IonRefresher, IonRefresherContent, IonGrid, IonRow, IonCol, IonSearchbar, IonSelect, IonSelectOption, IonAlert, IonActionSheet, IonFab, IonFabButton, IonIcon, IonList, IonChip, IonBadge } from '@ionic/react'
import { add, ellipsisVertical, refresh, checkmarkCircle, closeCircle, time, warning } from 'ionicons/icons'
import { ApiResponse, PaginatedResponse, License, LicenseStatus, LicenseType } from '@/types'
import { formatDate, getStatusColor, getRoleColor } from '@/lib/utils'

export default function LicensesPage() {
  const router = useRouter()
  const [licenses, setLicenses] = useState<License[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null)

  const fetchLicenses = async (page = 1, search = '', status = '', type = '') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(status && { status }),
        ...(type && { type }),
      })

      const response = await fetch(`/api/license/list?${params}`)
      const result: PaginatedResponse<License> = await response.json()

      if (result.success && result.data) {
        setLicenses(result.data)
        setPagination(result.pagination)
      } else {
        setAlertMessage(result.error || 'Failed to fetch licenses')
        setShowAlert(true)
      }
    } catch (error) {
      setAlertMessage('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLicenses()
  }, [])

  const handleRefresh = async (event: CustomEvent) => {
    await fetchLicenses(pagination.page, searchTerm, statusFilter, typeFilter)
    event.detail.complete()
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    fetchLicenses(1, value, statusFilter, typeFilter)
  }

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value)
    fetchLicenses(1, searchTerm, value, typeFilter)
  }

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value)
    fetchLicenses(1, searchTerm, statusFilter, value)
  }

  const handleLicenseAction = (license: License) => {
    setSelectedLicense(license)
    setShowActionSheet(true)
  }

  const handleRevokeLicense = async () => {
    if (!selectedLicense) return

    try {
      const response = await fetch('/api/license/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: selectedLicense.licenseKey,
          reason: 'Revoked by administrator',
        }),
      })

      const result: ApiResponse = await response.json()

      if (result.success) {
        setAlertMessage('License revoked successfully')
        setShowAlert(true)
        fetchLicenses(pagination.page, searchTerm, statusFilter, typeFilter)
      } else {
        setAlertMessage(result.error || 'Failed to revoke license')
        setShowAlert(true)
      }
    } catch (error) {
      setAlertMessage('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setShowActionSheet(false)
      setSelectedLicense(null)
    }
  }

  const getStatusIcon = (status: LicenseStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <IonIcon icon={checkmarkCircle} color="success" />
      case 'EXPIRED':
        return <IonIcon icon={closeCircle} color="danger" />
      case 'SUSPENDED':
        return <IonIcon icon={warning} color="warning" />
      case 'REVOKED':
        return <IonIcon icon={closeCircle} color="danger" />
      case 'PENDING':
        return <IonIcon icon={time} color="medium" />
      default:
        return null
    }
  }

  const isExpiringSoon = (expiresAt: Date | null) => {
    if (!expiresAt) return false
    const daysUntilExpiry = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>License Management</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding">
          {/* Filters */}
          <IonCard>
            <IonCardContent>
              <IonGrid>
                <IonRow>
                  <IonCol size="12" sizeMd="4">
                    <IonSearchbar
                      value={searchTerm}
                      onIonInput={(e) => handleSearch(e.detail.value!)}
                      placeholder="Search licenses..."
                    />
                  </IonCol>
                  <IonCol size="12" sizeMd="4">
                    <IonSelect
                      value={statusFilter}
                      placeholder="Filter by status"
                      onSelectionChange={(e) => handleStatusFilter(e.detail.value)}
                    >
                      <IonSelectOption value="">All Statuses</IonSelectOption>
                      <IonSelectOption value="ACTIVE">Active</IonSelectOption>
                      <IonSelectOption value="EXPIRED">Expired</IonSelectOption>
                      <IonSelectOption value="SUSPENDED">Suspended</IonSelectOption>
                      <IonSelectOption value="REVOKED">Revoked</IonSelectOption>
                      <IonSelectOption value="PENDING">Pending</IonSelectOption>
                    </IonSelect>
                  </IonCol>
                  <IonCol size="12" sizeMd="4">
                    <IonSelect
                      value={typeFilter}
                      placeholder="Filter by type"
                      onSelectionChange={(e) => handleTypeFilter(e.detail.value)}
                    >
                      <IonSelectOption value="">All Types</IonSelectOption>
                      <IonSelectOption value="EDUCATIONAL">Educational</IonSelectOption>
                      <IonSelectOption value="COMMERCIAL">Commercial</IonSelectOption>
                      <IonSelectOption value="TRIAL">Trial</IonSelectOption>
                      <IonSelectOption value="DEMO">Demo</IonSelectOption>
                    </IonSelect>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>

          {/* Licenses List */}
          <IonCard>
            <IonCardContent>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Licenses ({pagination.total})</h2>
                <IonButton
                  fill="outline"
                  onClick={() => fetchLicenses(pagination.page, searchTerm, statusFilter, typeFilter)}
                  disabled={isLoading}
                >
                  <IonIcon icon={refresh} slot="start" />
                  Refresh
                </IonButton>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <IonSpinner name="crescent" />
                </div>
              ) : (
                <IonList>
                  {licenses.map((license) => (
                    <IonItem key={license.id} button onClick={() => handleLicenseAction(license)}>
                      <IonLabel>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{license.licenseKey}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {license.user ? `${license.user.firstName} ${license.user.lastName}` : 'Unassigned'}
                              {license.branch && ` • ${license.branch.name}`}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <IonChip color={getStatusColor(license.status)}>
                                {getStatusIcon(license.status)}
                                <span className="ml-1">{license.status}</span>
                              </IonChip>
                              <IonChip color="medium">
                                {license.licenseType}
                              </IonChip>
                              {isExpiringSoon(license.expiresAt) && (
                                <IonBadge color="warning">Expires Soon</IonBadge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {license.usedDevices}/{license.maxDevices} devices
                            </p>
                            {license.expiresAt && (
                              <p className="text-xs text-gray-500">
                                Expires: {formatDate(license.expiresAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </IonLabel>
                      <IonIcon icon={ellipsisVertical} slot="end" />
                    </IonItem>
                  ))}
                </IonList>
              )}

              {!isLoading && licenses.length === 0 && (
                <div className="text-center py-8">
                  <IonText color="medium">
                    <p>No licenses found</p>
                  </IonText>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </div>

        {/* Floating Action Button */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton routerLink="/admin/licenses/create">
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        {/* Action Sheet */}
        <IonActionSheet
          isOpen={showActionSheet}
          onDidDismiss={() => setShowActionSheet(false)}
          header={selectedLicense?.licenseKey}
          buttons={[
            {
              text: 'View Details',
              handler: () => {
                // Navigate to license details
                router.push(`/admin/licenses/${selectedLicense?.id}`)
              },
            },
            {
              text: 'Revoke License',
              role: 'destructive',
              handler: handleRevokeLicense,
            },
            {
              text: 'Cancel',
              role: 'cancel',
            },
          ]}
        />

        {/* Alert */}
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Alert"
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  )
}