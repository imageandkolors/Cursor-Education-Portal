'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonText, IonButton, IonSpinner, IonAlert, IonRadioGroup, IonRadio, IonCheckbox, IonTextarea, IonProgressBar, IonIcon, IonBackButton, IonButtons } from '@ionic/react'
import { checkmarkCircle, time, warning, eye, eyeOff } from 'ionicons/icons'
import { ApiResponse, Question, ExamAttempt } from '@/types'

interface ExamAttemptPageProps {
  params: {
    examId: string
    attemptId: string
  }
}

export default function ExamAttemptPage({ params }: ExamAttemptPageProps) {
  const router = useRouter()
  const { examId, attemptId } = params
  
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [cheatAttempts, setCheatAttempts] = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    fetchAttempt()
    setupAntiCheat()
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.exitFullscreen?.()
    }
  }, [])

  useEffect(() => {
    if (attempt && attempt.exam) {
      const duration = attempt.exam.duration * 60 * 1000 // Convert to milliseconds
      const elapsed = Date.now() - startTimeRef.current
      setTimeLeft(Math.max(0, duration - elapsed))

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current
        const remaining = Math.max(0, duration - elapsed)
        setTimeLeft(remaining)

        if (remaining === 0) {
          handleSubmitExam()
        }
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [attempt])

  const fetchAttempt = async () => {
    try {
      // In a real implementation, you would fetch the attempt data
      // For now, we'll simulate it
      const mockAttempt: ExamAttempt = {
        id: attemptId,
        examId,
        studentId: 'current-user',
        token: 'MOCK-TOKEN',
        startTime: new Date(),
        status: 'IN_PROGRESS',
        totalMarks: 0,
        marksObtained: 0,
        percentage: 0,
        isOffline: false,
        cheatAttempts: 0,
        tabSwitches: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        exam: {
          id: examId,
          title: 'Sample Exam',
          duration: 60,
          totalMarks: 100,
          passingMarks: 50,
          startDate: new Date(),
          endDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
          isActive: true,
          isPublished: true,
          allowRetake: false,
          maxAttempts: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          classroomId: 'classroom-id',
          teacherId: 'teacher-id',
          type: 'QUIZ',
        },
        questions: [],
      }

      setAttempt(mockAttempt)
      setQuestions(mockAttempt.questions || [])
    } catch (error) {
      console.error('Failed to fetch attempt:', error)
      setAlertMessage('Failed to load exam')
      setShowAlert(true)
    }
  }

  const setupAntiCheat = () => {
    // Detect tab switches
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1)
        setCheatAttempts(prev => prev + 1)
        
        if (tabSwitches >= 3) {
          setAlertMessage('Too many tab switches detected. Exam will be submitted.')
          setShowAlert(true)
          setTimeout(() => handleSubmitExam(), 2000)
        }
      }
    }

    // Detect right-click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setCheatAttempts(prev => prev + 1)
    }

    // Detect F12 and other dev tools
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault()
        setCheatAttempts(prev => prev + 1)
      }
    }

    // Detect copy/paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      setCheatAttempts(prev => prev + 1)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('copy', handleCopy)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('copy', handleCopy)
    }
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }))
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmitExam = async () => {
    setIsSubmitting(true)

    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
        timeSpent: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }))

      const response = await fetch('/api/exams/attempt', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attemptId,
          answers: answerArray,
          cheatAttempts,
          tabSwitches,
        }),
      })

      const result: ApiResponse<ExamAttempt> = await response.json()

      if (result.success) {
        router.push(`/student/exams/${examId}/results/${attemptId}`)
      } else {
        setAlertMessage(result.error || 'Failed to submit exam')
        setShowAlert(true)
      }
    } catch (error) {
      setAlertMessage('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const currentQuestion = questions[currentQuestionIndex]

  if (!attempt || !currentQuestion) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div className="flex justify-center py-8">
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/student/exams" />
          </IonButtons>
          <IonTitle>{attempt.exam?.title}</IonTitle>
          <IonButton slot="end" onClick={toggleFullscreen}>
            <IonIcon icon={isFullscreen ? eyeOff : eye} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ion-padding">
          {/* Timer and Progress */}
          <IonCard>
            <IonCardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <IonIcon icon={time} className="mr-2" />
                  <span className="text-lg font-semibold">
                    {formatTime(Math.floor(timeLeft / 1000))}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
              </div>
              
              <IonProgressBar
                value={(currentQuestionIndex + 1) / questions.length}
                className="mb-2"
              />
              
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Progress</span>
                <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
              </div>
            </IonCardContent>
          </IonCard>

          {/* Question */}
          <IonCard>
            <IonCardContent>
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">
                  Question {currentQuestionIndex + 1}
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {currentQuestion.question}
                </p>
                <div className="text-sm text-gray-500">
                  Marks: {currentQuestion.marks} • Difficulty: {currentQuestion.difficulty}
                </div>
              </div>

              {/* Answer Options */}
              <div className="space-y-3">
                {currentQuestion.type === 'MULTIPLE_CHOICE' && (
                  <IonRadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onIonChange={(e) => handleAnswerChange(currentQuestion.id, e.detail.value)}
                  >
                    {currentQuestion.options?.map((option, index) => (
                      <IonItem key={index}>
                        <IonRadio slot="start" value={option} />
                        <IonLabel>{option}</IonLabel>
                      </IonItem>
                    ))}
                  </IonRadioGroup>
                )}

                {currentQuestion.type === 'TRUE_FALSE' && (
                  <IonRadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onIonChange={(e) => handleAnswerChange(currentQuestion.id, e.detail.value)}
                  >
                    <IonItem>
                      <IonRadio slot="start" value="true" />
                      <IonLabel>True</IonLabel>
                    </IonItem>
                    <IonItem>
                      <IonRadio slot="start" value="false" />
                      <IonLabel>False</IonLabel>
                    </IonItem>
                  </IonRadioGroup>
                )}

                {currentQuestion.type === 'FILL_BLANK' && (
                  <IonItem>
                    <IonInput
                      value={answers[currentQuestion.id] || ''}
                      onIonInput={(e) => handleAnswerChange(currentQuestion.id, e.detail.value!)}
                      placeholder="Enter your answer"
                    />
                  </IonItem>
                )}

                {['SHORT_ANSWER', 'ESSAY'].includes(currentQuestion.type) && (
                  <IonItem>
                    <IonTextarea
                      value={answers[currentQuestion.id] || ''}
                      onIonInput={(e) => handleAnswerChange(currentQuestion.id, e.detail.value!)}
                      placeholder="Enter your answer"
                      rows={currentQuestion.type === 'ESSAY' ? 6 : 3}
                    />
                  </IonItem>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <IonButton
              fill="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </IonButton>

            <div className="flex gap-2">
              {currentQuestionIndex < questions.length - 1 ? (
                <IonButton onClick={handleNextQuestion}>
                  Next
                </IonButton>
              ) : (
                <IonButton
                  color="success"
                  onClick={handleSubmitExam}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <IonSpinner name="crescent" /> : 'Submit Exam'}
                </IonButton>
              )}
            </div>
          </div>

          {/* Warning for cheating attempts */}
          {cheatAttempts > 0 && (
            <IonCard color="warning">
              <IonCardContent>
                <div className="flex items-center">
                  <IonIcon icon={warning} className="mr-2" />
                  <span>
                    Warning: {cheatAttempts} suspicious activity detected. 
                    {cheatAttempts >= 3 && ' Exam will be submitted automatically.'}
                  </span>
                </div>
              </IonCardContent>
            </IonCard>
          )}
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