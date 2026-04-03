import React, {useState, useCallback, useEffect} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import RootNavigator from './navigation/RootNavigator';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/onboarding/OnboardingScreen';
import {useSettingsStore} from './stores/useSettingsStore';
import {useTrackingStore} from './stores/useTrackingStore';
import {syncRoutesIfNeeded} from './services/routeSync';
import {recoverTracking, forceFlush, setOnPingCountUpdate} from './services/locationTracker';
import './i18n';

type AppPhase = 'hydrating' | 'splash' | 'onboarding' | 'main';

export default function App() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const [phase, setPhase] = useState<AppPhase>('hydrating');

  // Wait for store hydration, then decide initial phase
  useEffect(() => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      const onboarded = useSettingsStore.getState().hasCompletedOnboarding;
      setPhase(onboarded ? 'splash' : 'onboarding');
    });

    // If already hydrated (e.g. sync storage), check immediately
    if (useSettingsStore.persist.hasHydrated()) {
      setPhase(hasCompletedOnboarding ? 'splash' : 'onboarding');
    }

    return unsub;
  }, [hasCompletedOnboarding]);

  // Sync route data on app launch (non-blocking)
  useEffect(() => {
    syncRoutesIfNeeded().catch(() => {});
  }, []);

  // Recover background tracking on app launch if it was active
  useEffect(() => {
    const store = useTrackingStore.getState();
    if (store.isTracking) {
      console.log('[App] Recovering tracking session...');
      recoverTracking({
        routeId: store.tripMeta.routeId,
        busNumber: store.tripMeta.busNumber,
        crowdLevel: store.tripMeta.crowdLevel,
      }).then((ok) => {
        if (!ok) {
          console.warn('[App] Failed to recover tracking');
          useTrackingStore.getState().stopTracking();
        }
      });
    }

    setOnPingCountUpdate((count) => {
      useTrackingStore.getState().setPingCount(count);
    });

    return () => setOnPingCountUpdate(null);
  }, []);

  // Handle app state transitions
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        await forceFlush();
      } else if (nextState === 'active') {
        syncRoutesIfNeeded(true).catch(() => {});
        const store = useTrackingStore.getState();
        if (store.isTracking) {
          const ok = await recoverTracking({
            routeId: store.tripMeta.routeId,
            busNumber: store.tripMeta.busNumber,
            crowdLevel: store.tripMeta.crowdLevel,
          });
          if (!ok) {
            store.stopTracking();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleSplashReady = useCallback(() => {
    setPhase('main');
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    completeOnboarding();
    setPhase('main');
  }, [completeOnboarding]);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        {/* Show splash while hydrating store from AsyncStorage */}
        {phase === 'hydrating' && <SplashScreen onReady={() => {}} />}
        {phase === 'splash' && <SplashScreen onReady={handleSplashReady} />}
        {phase === 'onboarding' && (
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        )}
        {phase === 'main' && (
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
