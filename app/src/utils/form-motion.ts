import {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

export const formFadeIn = FadeIn.duration(150).reduceMotion(
  ReduceMotion.System,
);
export const formFadeOut = FadeOut.duration(120).reduceMotion(
  ReduceMotion.System,
);
export const formLayout = LinearTransition.duration(180).reduceMotion(
  ReduceMotion.System,
);
