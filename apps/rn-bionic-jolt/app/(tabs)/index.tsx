import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useGPUContext } from 'react-native-wgpu';
import '@/constants/polyfills';
import { setupGame } from '@/game/main';

export default function HomeScreen() {
  const { ref, context } = useGPUContext();

  useEffect(() => {
    if (!context) {
      return;
    }

    console.log(context);

    const destroy = setupGame(
      context.canvas as unknown as HTMLCanvasElement,
      context
    );

    return () => {
      destroy();
    };
  }, [context]);

  return (
    <View style={styles.container}>
      <Canvas ref={ref} style={styles.webgpu} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webgpu: {
    flex: 1,
  },
});
