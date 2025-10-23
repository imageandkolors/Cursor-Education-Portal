'use client'

import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonButton, IonGrid, IonRow, IonCol, IonIcon, IonText } from '@ionic/react'
import { school, people, shield, phonePortrait, laptop, globe } from 'ionicons/icons'

export default function LandingPage() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>SmartEdu360</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="ion-padding">
          {/* Hero Section */}
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              SmartEdu360
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              The Complete Educational Platform with License Management
            </p>
            <IonButton size="large" routerLink="/login">
              Get Started
            </IonButton>
          </div>

          {/* Features Section */}
          <IonGrid>
            <IonRow>
              <IonCol size="12" sizeMd="4">
                <IonCard>
                  <IonCardContent className="text-center">
                    <IonIcon icon={school} size="large" color="primary" className="mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Multi-Branch Schools</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Manage multiple school branches from a single platform
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="4">
                <IonCard>
                  <IonCardContent className="text-center">
                    <IonIcon icon={people} size="large" color="primary" className="mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Role-Based Access</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Admin, Teacher, Student, Parent, Bursar, and Store Manager roles
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="4">
                <IonCard>
                  <IonCardContent className="text-center">
                    <IonIcon icon={shield} size="large" color="primary" className="mb-4" />
                    <h3 className="text-lg font-semibold mb-2">License Management</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Comprehensive license verification and device management
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>

            <IonRow>
              <IonCol size="12" sizeMd="4">
                <IonCard>
                  <IonCardContent className="text-center">
                    <IonIcon icon={phonePortrait} size="large" color="primary" className="mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Mobile Apps</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Native iOS and Android apps with offline support
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="4">
                <IonCard>
                  <IonCardContent className="text-center">
                    <IonIcon icon={laptop} size="large" color="primary" className="mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Desktop Apps</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Cross-platform desktop applications for Windows, Mac, and Linux
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="12" sizeMd="4">
                <IonCard>
                  <IonCardContent className="text-center">
                    <IonIcon icon={globe} size="large" color="primary" className="mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Web Platform</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Modern web interface with offline-first architecture
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>

          {/* CTA Section */}
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Transform Your School?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Get started with SmartEdu360 today and experience the future of education management.
            </p>
            <IonButton size="large" routerLink="/login">
              Start Free Trial
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  )
}