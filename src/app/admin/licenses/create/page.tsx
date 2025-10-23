'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonAlert, IonSelect, IonSelectOption, IonTextarea, IonCheckbox, IonDatetime, IonBackButton, IonButtons } from '@ionic/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ApiResponse, License, LicenseFeatures, School, Branch, User } from '@/types'

const createLicenseSchema = z.object({
  schoolId: z.string().min(1, 'School is required'),
  branchId: z.string().optional(),
  userId: z.string().optional(),
  licenseType: z.enum(['EDUCATIONAL', 'COMMERCIAL', 'TRIAL', 'DEMO']),
  expiresAt: z.string().optional(),
  maxDevices: z.number().min(1).max(100),
  features: z.object({
    studentManagement: z.boolean(),
    teacherManagement: z.boolean(),
    parentPortal: z.boolean(),
    financialManagement: z.boolean(),
    storeManagement: z.boolean(),
    reporting: z.boolean(),
    offlineMode: z.boolean(),
    multiBranch: z.boolean(),
    customBranding: z.boolean(),
    apiAccess: z.boolean(),
  }),
})

type CreateLicenseForm = z.infer<typeof createLicenseSchema>

export default function CreateLicensePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateLicenseForm>({
    resolver: zodResolver(createLicenseSchema),
    defaultValues: {
      maxDevices: 1,
      features: {
        studentManagement: true,
        teacherManagement: true,
        parentPortal: true,
        financialManagement: false,
        storeManagement: false,
        reporting: true,
        offlineMode: true,
        multiBranch: false,
        customBranding: false,
        apiAccess: false,
      },
    },
  })

  const selectedSchoolId = watch('schoolId')
  const selectedBranchId = watch('branchId')

  useEffect(() => {
    fetchSchools()
  }, [])

  useEffect(() => {
    if (selectedSchoolId) {
      fetchBranches(selectedSchoolId)
      fetchUsers(selectedSchoolId)
    }
  }, [selectedSchoolId])

  useEffect(() => {
    if (selectedBranchId) {
      fetchUsers(selectedSchoolId, selectedBranchId)
    }
  }, [selectedBranchId])

  const fetchSchools = async () => {
    try {
      const response = await fetch('/api/schools')
      const result: ApiResponse<School[]> = await response.json()
      if (result.success && result.data) {
        setSchools(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch schools:', error)
    }
  }

  const fetchBranches = async (schoolId: string) => {
    try {
      const response = await fetch(`/api/schools/${schoolId}/branches`)
      const result: ApiResponse<Branch[]> = await response.json()
      if (result.success && result.data) {
        setBranches(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error)
    }
  }

  const fetchUsers = async (schoolId: string, branchId?: string) => {
    try {
      const params = new URLSearchParams({ schoolId })
      if (branchId) params.append('branchId', branchId)
      
      const response = await fetch(`/api/users?${params}`)
      const result: ApiResponse<User[]> = await response.json()
      if (result.success && result.data) {
        setUsers(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const onSubmit = async (data: CreateLicenseForm) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/license/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result: ApiResponse<License> = await response.json()

      if (result.success && result.data) {
        setAlertMessage('License created successfully!')
        setShowAlert(true)
        router.push('/admin/licenses')
      } else {
        setAlertMessage(result.error || 'Failed to create license')
        setShowAlert(true)
      }
    } catch (error) {
      setAlertMessage('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin/licenses" />
          </IonButtons>
          <IonTitle>Create License</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ion-padding">
          <IonCard>
            <IonCardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* School Selection */}
                <IonItem>
                  <IonLabel position="stacked">School *</IonLabel>
                  <IonSelect
                    value={watch('schoolId')}
                    onSelectionChange={(e) => setValue('schoolId', e.detail.value)}
                    placeholder="Select a school"
                  >
                    {schools.map((school) => (
                      <IonSelectOption key={school.id} value={school.id}>
                        {school.name} ({school.code})
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                {errors.schoolId && (
                  <IonText color="danger" className="text-sm">
                    {errors.schoolId.message}
                  </IonText>
                )}

                {/* Branch Selection */}
                <IonItem>
                  <IonLabel position="stacked">Branch (Optional)</IonLabel>
                  <IonSelect
                    value={watch('branchId')}
                    onSelectionChange={(e) => setValue('branchId', e.detail.value)}
                    placeholder="Select a branch"
                  >
                    {branches.map((branch) => (
                      <IonSelectOption key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>

                {/* User Selection */}
                <IonItem>
                  <IonLabel position="stacked">User (Optional)</IonLabel>
                  <IonSelect
                    value={watch('userId')}
                    onSelectionChange={(e) => setValue('userId', e.detail.value)}
                    placeholder="Select a user"
                  >
                    {users.map((user) => (
                      <IonSelectOption key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>

                {/* License Type */}
                <IonItem>
                  <IonLabel position="stacked">License Type *</IonLabel>
                  <IonSelect
                    value={watch('licenseType')}
                    onSelectionChange={(e) => setValue('licenseType', e.detail.value)}
                    placeholder="Select license type"
                  >
                    <IonSelectOption value="EDUCATIONAL">Educational</IonSelectOption>
                    <IonSelectOption value="COMMERCIAL">Commercial</IonSelectOption>
                    <IonSelectOption value="TRIAL">Trial</IonSelectOption>
                    <IonSelectOption value="DEMO">Demo</IonSelectOption>
                  </IonSelect>
                </IonItem>
                {errors.licenseType && (
                  <IonText color="danger" className="text-sm">
                    {errors.licenseType.message}
                  </IonText>
                )}

                {/* Expiration Date */}
                <IonItem>
                  <IonLabel position="stacked">Expiration Date (Optional)</IonLabel>
                  <IonDatetime
                    value={watch('expiresAt')}
                    onIonChange={(e) => setValue('expiresAt', e.detail.value as string)}
                    presentation="date"
                    placeholder="Select expiration date"
                  />
                </IonItem>

                {/* Max Devices */}
                <IonItem>
                  <IonLabel position="stacked">Maximum Devices *</IonLabel>
                  <IonInput
                    type="number"
                    value={watch('maxDevices')}
                    onIonInput={(e) => setValue('maxDevices', parseInt(e.detail.value!))}
                    placeholder="Enter maximum devices"
                    min="1"
                    max="100"
                  />
                </IonItem>
                {errors.maxDevices && (
                  <IonText color="danger" className="text-sm">
                    {errors.maxDevices.message}
                  </IonText>
                )}

                {/* Features */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Features</h3>
                  
                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.studentManagement')}
                      onIonChange={(e) => setValue('features.studentManagement', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Student Management</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.teacherManagement')}
                      onIonChange={(e) => setValue('features.teacherManagement', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Teacher Management</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.parentPortal')}
                      onIonChange={(e) => setValue('features.parentPortal', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Parent Portal</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.financialManagement')}
                      onIonChange={(e) => setValue('features.financialManagement', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Financial Management</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.storeManagement')}
                      onIonChange={(e) => setValue('features.storeManagement', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Store Management</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.reporting')}
                      onIonChange={(e) => setValue('features.reporting', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Reporting</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.offlineMode')}
                      onIonChange={(e) => setValue('features.offlineMode', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Offline Mode</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.multiBranch')}
                      onIonChange={(e) => setValue('features.multiBranch', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Multi-Branch Support</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.customBranding')}
                      onIonChange={(e) => setValue('features.customBranding', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">Custom Branding</IonLabel>
                  </IonItem>

                  <IonItem>
                    <IonCheckbox
                      checked={watch('features.apiAccess')}
                      onIonChange={(e) => setValue('features.apiAccess', e.detail.checked)}
                    />
                    <IonLabel className="ml-3">API Access</IonLabel>
                  </IonItem>
                </div>

                {/* Submit Button */}
                <IonButton
                  expand="block"
                  type="submit"
                  disabled={isLoading}
                  className="mt-6"
                >
                  {isLoading ? <IonSpinner name="crescent" /> : 'Create License'}
                </IonButton>
              </form>
            </IonCardContent>
          </IonCard>
        </div>

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