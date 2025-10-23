'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner, IonAlert } from '@ionic/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ApiResponse, AuthUser } from '@/types'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAlert, setShowAlert] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result: ApiResponse<AuthUser> = await response.json()

      if (result.success && result.data) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(result.error || 'Login failed')
        setShowAlert(true)
      }
    } catch (error) {
      setError('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>SmartEdu360</IonTitle>
        </IonToolbar>
      </IonHeader>
      
      <IonContent className="ion-padding">
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="w-full max-w-md">
            <IonCard>
              <IonCardContent className="p-6">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome to SmartEdu360
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Sign in to your account
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <IonItem>
                    <IonLabel position="stacked">Email</IonLabel>
                    <IonInput
                      type="email"
                      {...register('email')}
                      placeholder="Enter your email"
                    />
                  </IonItem>
                  {errors.email && (
                    <IonText color="danger" className="text-sm">
                      {errors.email.message}
                    </IonText>
                  )}

                  <IonItem>
                    <IonLabel position="stacked">Password</IonLabel>
                    <IonInput
                      type="password"
                      {...register('password')}
                      placeholder="Enter your password"
                    />
                  </IonItem>
                  {errors.password && (
                    <IonText color="danger" className="text-sm">
                      {errors.password.message}
                    </IonText>
                  )}

                  <IonButton
                    expand="block"
                    type="submit"
                    disabled={isLoading}
                    className="mt-6"
                  >
                    {isLoading ? <IonSpinner name="crescent" /> : 'Sign In'}
                  </IonButton>
                </form>

                <div className="mt-6 text-center">
                  <IonText color="medium">
                    <p className="text-sm">
                      Need help? Contact your system administrator
                    </p>
                  </IonText>
                </div>
              </IonCardContent>
            </IonCard>
          </div>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Login Failed"
          message={error}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  )
}