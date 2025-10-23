'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonText, IonButton, IonSpinner, IonRefresher, IonRefresherContent, IonGrid, IonRow, IonCol, IonFab, IonFabButton, IonIcon, IonChip, IonBadge } from '@ionic/react'
import { add, people, document, chatbubbles, time, school, ellipsisVertical } from 'ionicons/icons'
import { ApiResponse, Classroom } from '@/types'
import { formatDate } from '@/lib/utils'

export default function TeacherClassroomsPage() {
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchClassrooms = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/classrooms?role=teacher')
      const result: ApiResponse<Classroom[]> = await response.json()

      if (result.success && result.data) {
        setClassrooms(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch classrooms:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClassrooms()
  }, [])

  const handleRefresh = async (event: CustomEvent) => {
    await fetchClassrooms()
    event.detail.complete()
  }

  const handleClassroomAction = (classroom: Classroom) => {
    router.push(`/teacher/classrooms/${classroom.id}`)
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>My Classrooms</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <IonGrid>
              <IonRow>
                {classrooms.map((classroom) => (
                  <IonCol size="12" sizeMd="6" key={classroom.id}>
                    <IonCard button onClick={() => handleClassroomAction(classroom)}>
                      <IonCardContent>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {classroom.name}
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {classroom.subject} • {classroom.grade || 'All Grades'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Code: {classroom.code}
                            </p>
                          </div>
                          <IonIcon icon={ellipsisVertical} className="text-gray-400" />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <IonIcon icon={people} className="mr-2" />
                            <span>{classroom.currentStudents}/{classroom.maxStudents} students</span>
                          </div>

                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <IonIcon icon={document} className="mr-2" />
                            <span>{classroom._count?.materials || 0} materials</span>
                          </div>

                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <IonIcon icon={chatbubbles} className="mr-2" />
                            <span>{classroom._count?.discussions || 0} discussions</span>
                          </div>

                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <IonIcon icon={time} className="mr-2" />
                            <span>Created {formatDate(classroom.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <div className="flex gap-2">
                            <IonChip color={classroom.isPublic ? 'success' : 'medium'}>
                              {classroom.isPublic ? 'Public' : 'Private'}
                            </IonChip>
                            <IonChip color={classroom.isActive ? 'success' : 'danger'}>
                              {classroom.isActive ? 'Active' : 'Inactive'}
                            </IonChip>
                          </div>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                ))}
              </IonRow>

              {classrooms.length === 0 && (
                <IonRow>
                  <IonCol size="12">
                    <IonCard>
                      <IonCardContent className="text-center py-12">
                        <IonIcon icon={school} size="large" color="medium" className="mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          No Classrooms Yet
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Create your first classroom to start teaching
                        </p>
                        <IonButton routerLink="/teacher/classrooms/create">
                          Create Classroom
                        </IonButton>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                </IonRow>
              )}
            </IonGrid>
          )}
        </div>

        {/* Floating Action Button */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton routerLink="/teacher/classrooms/create">
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>
      </IonContent>
    </IonPage>
  )
}