'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonText, IonButton, IonSpinner, IonRefresher, IonRefresherContent, IonGrid, IonRow, IonCol, IonChip, IonBadge, IonAlert, IonInput } from '@ionic/react'
import { time, school, checkmarkCircle, closeCircle, play, eye } from 'ionicons/icons'
import { ApiResponse, Exam } from '@/types'
import { formatDate, formatDateTime } from '@/lib/utils'

export default function StudentExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<Exam[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showTokenAlert, setShowTokenAlert] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const [token, setToken] = useState('')

  const fetchExams = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/exams?role=student')
      const result: ApiResponse<Exam[]> = await response.json()

      if (result.success && result.data) {
        setExams(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch exams:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchExams()
  }, [])

  const handleRefresh = async (event: CustomEvent) => {
    await fetchExams()
    event.detail.complete()
  }

  const handleStartExam = (exam: Exam) => {
    setSelectedExam(exam)
    setShowTokenAlert(true)
  }

  const handleTokenSubmit = async () => {
    if (!selectedExam || !token.trim()) return

    try {
      const response = await fetch('/api/exams/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          examId: selectedExam.id,
          token: token.trim(),
        }),
      })

      const result: ApiResponse<ExamAttempt> = await response.json()

      if (result.success && result.data) {
        router.push(`/student/exams/${selectedExam.id}/attempt/${result.data.id}`)
      } else {
        setAlertMessage(result.error || 'Failed to start exam')
        setShowAlert(true)
      }
    } catch (error) {
      setAlertMessage('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setShowTokenAlert(false)
      setToken('')
      setSelectedExam(null)
    }
  }

  const getExamStatus = (exam: Exam) => {
    const now = new Date()
    const startDate = new Date(exam.startDate)
    const endDate = new Date(exam.endDate)

    if (now < startDate) {
      return { status: 'upcoming', color: 'warning', text: 'Upcoming' }
    } else if (now > endDate) {
      return { status: 'ended', color: 'danger', text: 'Ended' }
    } else {
      return { status: 'active', color: 'success', text: 'Active' }
    }
  }

  const canTakeExam = (exam: Exam) => {
    const now = new Date()
    const startDate = new Date(exam.startDate)
    const endDate = new Date(exam.endDate)
    return now >= startDate && now <= endDate && exam.isPublished
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>My Exams</IonTitle>
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
                {exams.map((exam) => {
                  const examStatus = getExamStatus(exam)
                  const canTake = canTakeExam(exam)

                  return (
                    <IonCol size="12" sizeMd="6" key={exam.id}>
                      <IonCard>
                        <IonCardContent>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {exam.title}
                              </h2>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {exam.classroom?.name} • {exam.classroom?.subject}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {exam.type} • {exam.duration} minutes
                              </p>
                            </div>
                            <IonChip color={examStatus.color}>
                              {examStatus.text}
                            </IonChip>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <IonIcon icon={time} className="mr-2" />
                              <span>Duration: {exam.duration} minutes</span>
                            </div>

                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <IonIcon icon={school} className="mr-2" />
                              <span>Marks: {exam.totalMarks}</span>
                            </div>

                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <IonIcon icon={time} className="mr-2" />
                              <span>Starts: {formatDateTime(exam.startDate)}</span>
                            </div>

                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <IonIcon icon={time} className="mr-2" />
                              <span>Ends: {formatDateTime(exam.endDate)}</span>
                            </div>
                          </div>

                          {exam.description && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {exam.description}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex gap-2">
                              <IonChip color="medium">
                                {exam._count?.questions || 0} questions
                              </IonChip>
                              {exam.allowRetake && (
                                <IonChip color="primary">
                                  Retake allowed
                                </IonChip>
                              )}
                            </div>

                            <div className="flex gap-2">
                              {canTake ? (
                                <IonButton
                                  size="small"
                                  onClick={() => handleStartExam(exam)}
                                >
                                  <IonIcon icon={play} slot="start" />
                                  Start
                                </IonButton>
                              ) : (
                                <IonButton
                                  size="small"
                                  fill="outline"
                                  disabled
                                >
                                  <IonIcon icon={eye} slot="start" />
                                  View
                                </IonButton>
                              )}
                            </div>
                          </div>
                        </IonCardContent>
                      </IonCard>
                    </IonCol>
                  )
                })}
              </IonRow>

              {exams.length === 0 && (
                <IonRow>
                  <IonCol size="12">
                    <IonCard>
                      <IonCardContent className="text-center py-12">
                        <IonIcon icon={school} size="large" color="medium" className="mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          No Exams Available
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          You don't have any exams assigned yet
                        </p>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                </IonRow>
              )}
            </IonGrid>
          )}
        </div>

        {/* Token Input Alert */}
        <IonAlert
          isOpen={showTokenAlert}
          onDidDismiss={() => setShowTokenAlert(false)}
          header="Enter Exam Token"
          message={selectedExam ? `Enter the token for "${selectedExam.title}"` : ''}
          inputs={[
            {
              name: 'token',
              type: 'text',
              placeholder: 'Enter exam token',
              value: token,
            },
          ]}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Start Exam',
              handler: (data) => {
                setToken(data.token)
                handleTokenSubmit()
              },
            },
          ]}
        />
      </IonContent>
    </IonPage>
  )
}