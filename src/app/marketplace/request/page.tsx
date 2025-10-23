'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonAlert, IonTextarea, IonSelect, IonSelectOption, IonBackButton, IonButtons } from '@ionic/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ApiResponse, ProductRequest, ProductCategory } from '@/types'

const createRequestSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.enum(['BOOKS', 'UNIFORMS', 'STATIONERY', 'ELECTRONICS', 'SPORTS', 'FOOD', 'TRANSPORT', 'SERVICES', 'DIGITAL', 'OTHER']),
  estimatedPrice: z.number().min(0).optional(),
  quantity: z.number().min(1).default(1),
})

type CreateRequestForm = z.infer<typeof createRequestSchema>

export default function RequestProductPage() {
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
  } = useForm<CreateRequestForm>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      quantity: 1,
    },
  })

  const onSubmit = async (data: CreateRequestForm) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/marketplace/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result: ApiResponse<ProductRequest> = await response.json()

      if (result.success && result.data) {
        setAlertMessage('Product request submitted successfully!')
        setShowAlert(true)
        router.push('/marketplace')
      } else {
        setAlertMessage(result.error || 'Failed to submit request')
        setShowAlert(true)
      }
    } catch (error) {
      setAlertMessage('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setIsLoading(false)
    }
  }

  const categoryOptions: { value: ProductCategory; label: string }[] = [
    { value: 'BOOKS', label: 'Books' },
    { value: 'UNIFORMS', label: 'Uniforms' },
    { value: 'STATIONERY', label: 'Stationery' },
    { value: 'ELECTRONICS', label: 'Electronics' },
    { value: 'SPORTS', label: 'Sports' },
    { value: 'FOOD', label: 'Food' },
    { value: 'TRANSPORT', label: 'Transport' },
    { value: 'SERVICES', label: 'Services' },
    { value: 'DIGITAL', label: 'Digital' },
    { value: 'OTHER', label: 'Other' },
  ]

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/marketplace" />
          </IonButtons>
          <IonTitle>Request Product</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ion-padding">
          <IonCard>
            <IonCardContent>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Request a Product
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Can't find what you're looking for? Request a product and we'll try to make it available.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Product Name */}
                <IonItem>
                  <IonLabel position="stacked">Product Name *</IonLabel>
                  <IonInput
                    value={watch('name')}
                    onIonInput={(e) => setValue('name', e.detail.value!)}
                    placeholder="Enter product name"
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
                    placeholder="Describe the product you need"
                    rows={3}
                  />
                </IonItem>

                {/* Category */}
                <IonItem>
                  <IonLabel position="stacked">Category *</IonLabel>
                  <IonSelect
                    value={watch('category')}
                    onSelectionChange={(e) => setValue('category', e.detail.value)}
                    placeholder="Select category"
                  >
                    {categoryOptions.map((option) => (
                      <IonSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                {errors.category && (
                  <IonText color="danger" className="text-sm">
                    {errors.category.message}
                  </IonText>
                )}

                {/* Estimated Price */}
                <IonItem>
                  <IonLabel position="stacked">Estimated Price (Optional)</IonLabel>
                  <IonInput
                    type="number"
                    value={watch('estimatedPrice')}
                    onIonInput={(e) => setValue('estimatedPrice', parseFloat(e.detail.value!) || 0)}
                    placeholder="Enter estimated price"
                    min="0"
                    step="0.01"
                  />
                </IonItem>

                {/* Quantity */}
                <IonItem>
                  <IonLabel position="stacked">Quantity *</IonLabel>
                  <IonInput
                    type="number"
                    value={watch('quantity')}
                    onIonInput={(e) => setValue('quantity', parseInt(e.detail.value!) || 1)}
                    placeholder="Enter quantity needed"
                    min="1"
                  />
                </IonItem>
                {errors.quantity && (
                  <IonText color="danger" className="text-sm">
                    {errors.quantity.message}
                  </IonText>
                )}

                {/* Submit Button */}
                <IonButton
                  expand="block"
                  type="submit"
                  disabled={isLoading}
                  className="mt-6"
                >
                  {isLoading ? <IonSpinner name="crescent" /> : 'Submit Request'}
                </IonButton>
              </form>
            </IonCardContent>
          </IonCard>

          {/* Information Card */}
          <IonCard>
            <IonCardContent>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                How it works
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Submit your product request with details</li>
                <li>• Our team will review and approve suitable requests</li>
                <li>• Approved products will be added to the marketplace</li>
                <li>• You'll be notified when your requested product is available</li>
                <li>• You can then purchase it through the normal ordering process</li>
              </ul>
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