import React, {useRef, useState, useCallback} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  ViewToken,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors} from '../../constants/theme';
import Button from '../../components/common/Button';
import ProgressDots from '../../components/common/ProgressDots';
import OnboardingWelcome from './OnboardingWelcome';
import OnboardingHowItWorks from './OnboardingHowItWorks';
import OnboardingLanguage from './OnboardingLanguage';
import OnboardingLocation from './OnboardingLocation';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const TOTAL_STEPS = 4;

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({onComplete}: OnboardingScreenProps) {
  const {t} = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentPage(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({viewAreaCoveragePercentThreshold: 50}).current;

  const goToNext = () => {
    if (currentPage < TOTAL_STEPS - 1) {
      flatListRef.current?.scrollToIndex({index: currentPage + 1, animated: true});
    }
  };

  const isLastPage = currentPage === TOTAL_STEPS - 1;

  const pages = [
    {key: 'welcome', component: <OnboardingWelcome />},
    {key: 'how', component: <OnboardingHowItWorks />},
    {key: 'language', component: <OnboardingLanguage />},
    {key: 'location', component: <OnboardingLocation onComplete={onComplete} />},
  ];

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        renderItem={({item}) => (
          <View style={styles.page}>{item.component}</View>
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom controls — hidden on last page (location has its own buttons) */}
      {!isLastPage && (
        <View style={styles.bottomControls}>
          <ProgressDots total={TOTAL_STEPS} current={currentPage} />

          <Button
            title={t('onboarding.next', 'Next')}
            onPress={goToNext}
            style={styles.nextButton}
          />

          <Button
            title={t('onboarding.skip', 'Skip')}
            onPress={onComplete}
            variant="text"
          />
        </View>
      )}

      {/* Progress dots on last page too */}
      {isLastPage && (
        <View style={styles.lastPageDots}>
          <ProgressDots total={TOTAL_STEPS} current={currentPage} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  bottomControls: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
    alignItems: 'center',
  },
  nextButton: {
    width: '100%',
  },
  lastPageDots: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
