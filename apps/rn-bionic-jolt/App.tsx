import { useConfigureContext, useRoot } from '@typegpu/react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas } from 'react-native-wgpu';
import { setupGame } from './game/main';
import { useEffect } from 'react';

export default function App() {
  const root = useRoot();
  const { ref, ctxRef } = useConfigureContext({ alphaMode: 'premultiplied' });

  useEffect(() => {
    if (!ctxRef.current) return;

    const ctrl = new AbortController();
    setupGame(ctrl.signal, root, ctxRef.current);

    return () => ctrl.abort();
  }, [root, ctxRef]);

  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <Canvas ref={ref} style={{ width, height }} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
