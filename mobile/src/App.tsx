import React, {useState, useCallback} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import RootNavigator from './navigation/RootNavigator';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/onboarding/OnboardingScreen';
import {useSettingsStore} from './stores/useSettingsStore';
import './i18n';

type AppPhase = 'splash' | 'onboarding' | 'main';

export default function App() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const [phase, setPhase] = useState<AppPhase>(
    hasCompletedOnboarding ? 'splash' : 'onboarding',
  );

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
