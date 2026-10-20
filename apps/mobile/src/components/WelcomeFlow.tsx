import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { IntroAnimationScreen } from './IntroAnimationScreen';
import { OnboardingModal } from './OnboardingModal';

interface WelcomeFlowProps {
  visible: boolean;
  onClose: () => void;
  startWithAnimation?: boolean;
}

export function WelcomeFlow({
  visible,
  onClose,
  startWithAnimation = true,
}: WelcomeFlowProps) {
  const [stage, setStage] = useState<'animation' | 'welcome'>(
    startWithAnimation ? 'animation' : 'welcome'
  );

  useEffect(() => {
    if (visible) {
      setStage(startWithAnimation ? 'animation' : 'welcome');
    }
  }, [visible, startWithAnimation]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        {stage === 'animation' ? (
          <IntroAnimationScreen
            onFinish={() => {
              setStage('welcome');
            }}
          />
        ) : (
          <OnboardingModal
            visible={true}
            onClose={() => {
              onClose();
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
  },
});
