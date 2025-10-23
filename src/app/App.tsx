'use client'

import { useEffect } from 'react'
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { Route, Redirect } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { offlineManager } from '@/lib/offline'

// Import pages
import LandingPage from './landing/page'
import LoginPage from './login/page'
import DashboardPage from './dashboard/page'
import LicensesPage from './admin/licenses/page'
import CreateLicensePage from './admin/licenses/create/page'

// Import styles
import '@ionic/react/css/core.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import '@ionic/react/css/padding.css'
import '@ionic/react/css/float-elements.css'
import '@ionic/react/css/text-alignment.css'
import '@ionic/react/css/text-transformation.css'
import '@ionic/react/css/flex-utils.css'
import '@ionic/react/css/display.css'

// Setup Ionic React
setupIonicReact({
  mode: 'ios',
  rippleEffect: false,
  animated: true,
})

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
})

export default function App() {
  useEffect(() => {
    // Initialize offline manager
    offlineManager.isDeviceOnline()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <IonApp>
          <IonReactRouter>
            <IonRouterOutlet>
              <Route path="/landing" component={LandingPage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/admin/licenses" component={LicensesPage} />
              <Route path="/admin/licenses/create" component={CreateLicensePage} />
              <Route exact path="/" render={() => <Redirect to="/landing" />} />
            </IonRouterOutlet>
          </IonReactRouter>
        </IonApp>
      </ThemeProvider>
    </QueryClientProvider>
  )
}