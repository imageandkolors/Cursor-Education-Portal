'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonText, IonButton, IonSpinner, IonRefresher, IonRefresherContent, IonGrid, IonRow, IonCol } from '@ionic/react'
import { ApiResponse, AuthUser } from '@/types'
import { getRoleColor, formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      const result: ApiResponse<AuthUser> = await response.json()

      if (result.success && result.data) {
        setUser(result.data)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  const handleRefresh = async (event: CustomEvent) => {
    await fetchUser()
    event.detail.complete()
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (isLoading) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div className="flex items-center justify-center min-h-screen">
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    )
  }

  if (!user) {
    return null
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back, {user.firstName}!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Here's what's happening with your account
            </p>
          </div>

          <IonGrid>
            <IonRow>
              <IonCol size="12" sizeMd="6">
                <IonCard>
                  <IonCardContent>
                    <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
                    <div className="space-y-3">
                      <IonItem>
                        <IonLabel>
                          <h3>Name</h3>
                          <p>{user.firstName} {user.lastName}</p>
                        </IonLabel>
                      </IonItem>
                      <IonItem>
                        <IonLabel>
                          <h3>Email</h3>
                          <p>{user.email}</p>
                        </IonLabel>
                      </IonItem>
                      <IonItem>
                        <IonLabel>
                          <h3>Username</h3>
                          <p>{user.username}</p>
                        </IonLabel>
                      </IonItem>
                      <IonItem>
                        <IonLabel>
                          <h3>Role</h3>
                          <IonText>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                              {user.role}
                            </span>
                          </IonText>
                        </IonLabel>
                      </IonItem>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="6">
                <IonCard>
                  <IonCardContent>
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="space-y-3">
                      {user.role === 'ADMIN' && (
                        <>
                          <IonButton expand="block" fill="outline" routerLink="/admin/schools">
                            Manage Schools
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/admin/licenses">
                            Manage Licenses
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/admin/users">
                            Manage Users
                          </IonButton>
                        </>
                      )}
                      
                      {user.role === 'TEACHER' && (
                        <>
                          <IonButton expand="block" fill="outline" routerLink="/teacher/classes">
                            My Classes
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/teacher/students">
                            Students
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/teacher/assignments">
                            Assignments
                          </IonButton>
                        </>
                      )}

                      {user.role === 'STUDENT' && (
                        <>
                          <IonButton expand="block" fill="outline" routerLink="/student/classes">
                            My Classes
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/student/assignments">
                            Assignments
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/student/grades">
                            Grades
                          </IonButton>
                        </>
                      )}

                      {user.role === 'PARENT' && (
                        <>
                          <IonButton expand="block" fill="outline" routerLink="/parent/children">
                            My Children
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/parent/grades">
                            View Grades
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/parent/notifications">
                            Notifications
                          </IonButton>
                        </>
                      )}

                      {user.role === 'BURSAR' && (
                        <>
                          <IonButton expand="block" fill="outline" routerLink="/bursar/fees">
                            Fee Management
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/bursar/payments">
                            Payments
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/bursar/reports">
                            Financial Reports
                          </IonButton>
                        </>
                      )}

                      {user.role === 'STORE_MANAGER' && (
                        <>
                          <IonButton expand="block" fill="outline" routerLink="/store/inventory">
                            Inventory
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/store/products">
                            Products
                          </IonButton>
                          <IonButton expand="block" fill="outline" routerLink="/store/sales">
                            Sales
                          </IonButton>
                        </>
                      )}

                      <IonButton expand="block" fill="outline" routerLink="/profile">
                        Profile Settings
                      </IonButton>
                      <IonButton expand="block" fill="outline" color="danger" onClick={handleLogout}>
                        Logout
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </IonContent>
    </IonPage>
  )
}