'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonAlert, IonTextarea, IonCheckbox, IonBackButton, IonButtons } from '@ionic/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ApiResponse, Classroom } from '@/types'

const createClassroomSchema = z.object({
  name: z.string().min(1, 'Classroom name is required'),
  description: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  grade: z.string().optional(),
  isPublic: z.boolean().default(false),
  maxStudents: z.number().min(1).max(200).default(50),
})

type CreateClassroomForm = z.infer<typeof createClassroomSchema>

export default function CreateClassroomPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateClassroomForm>({
    resolver: zodResolver(createClassroomSchema),
    defaultValues: {
      maxStudents: 50,
      isPublic: false,
    },
  })

  const onSubmit = async (data: CreateClassroomForm) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result: ApiResponse<Classroom> = await response.json()

      if (result.success && result.data) {
        setAlertMessage('Classroom created successfully!')
        setShowAlert(true)
        router.push('/teacher/classrooms')
      } else {
        setAlertMessage(result.error || 'Failed to create classroom')
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
            <IonBackButton defaultHref="/teacher/classrooms" />
          </IonButtons>
          <IonTitle>Create Classroom</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ion-padding">
          <IonCard>
            <IonCardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Classroom Name */}
                <IonItem>
                  <IonLabel position="stacked">Classroom Name *</IonLabel>
                  <IonInput
                    value={watch('name')}
                    onIonInput={(e) => setValue('name', e.detail.value!)}
                    placeholder="Enter classroom name"
                  />
                </IonItem>
                {errors.name && (
                  <IonText color="danger" className="text-sm">
                    {errors.name.message}
                  </IonText>
                )}

                {/* Description */}
                <IonItem>
                  <IonLabel position="stacked">Description</IonLabel>
                  <IonTextarea
                    value={watch('description')}
                    onIonInput={(e) => setValue('description', e.detail.value!)}
                    placeholder="Enter classroom description"
                    rows={3}
                  />
                </IonItem>

                {/* Subject */}
                <IonItem>
                  <IonLabel position="stacked">Subject *</IonLabel>
                  <IonInput
                    value={watch('subject')}
                    onIonInput={(e) => setValue('subject', e.detail.value!)}
                    placeholder="Enter subject"
                  />
                </IonItem>
                {errors.subject && (
                  <IonText color="danger" className="text-sm">
                    {errors.subject.message}
                  </IonText>
                )}

                {/* Grade */}
                <IonItem>
                  <IonLabel position="stacked">Grade (Optional)</IonLabel>
                  <IonInput
                    value={watch('grade')}
                    onIonInput={(e) => setValue('grade', e.detail.value!)}
                    placeholder="Enter grade level"
                  />
                </IonItem>

                {/* Max Students */}
                <IonItem>
                  <IonLabel position="stacked">Maximum Students *</IonLabel>
                  <IonInput
                    type="number"
                    value={watch('maxStudents')}
                    onIonInput={(e) => setValue('maxStudents', parseInt(e.detail.value!))}
                    placeholder="Enter maximum students"
                    min="1"
                    max="200"
                  />
                </IonItem>
                {errors.maxStudents && (
                  <IonText color="danger" className="text-sm">
                    {errors.maxStudents.message}
                  </IonText>
                )}

                {/* Public Classroom */}
                <IonItem>
                  <IonCheckbox
                    checked={watch('isPublic')}
                    onIonChange={(e) => setValue('isPublic', e.detail.checked)}
                  />
                  <IonLabel className="ml-3">
                    <h3>Public Classroom</h3>
                    <p>Allow students to join using the classroom code</p>
                  </IonLabel>
                </IonItem>

                {/* Submit Button */}
                <IonButton
                  expand="block"
                  type="submit"
                  disabled={isLoading}
                  className="mt-6"
                >
                  {isLoading ? <IonSpinner name="crescent" /> : 'Create Classroom'}
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