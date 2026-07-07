import { Composition } from 'remotion';
import { OnboardingVideo } from '../lib/remotion/OnboardingScene';

export const FPS = 30;

export default function RemotionRoot() {
  return (
    <Composition
      id="NotchOnboarding"
      component={OnboardingVideo}
      durationInFrames={600}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
}
