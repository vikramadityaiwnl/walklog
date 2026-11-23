import {
  FadeOut,
  Keyframe,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

export const listItemEnter = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 6 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
})
  .duration(200)
  .reduceMotion(ReduceMotion.System);

export const listItemExit = FadeOut.duration(140).reduceMotion(
  ReduceMotion.System,
);

export const listItemLayout = LinearTransition.duration(180).reduceMotion(
  ReduceMotion.System,
);
