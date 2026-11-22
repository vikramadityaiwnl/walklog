import { View, StyleSheet } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

interface Props {
  illustration: number;
}

const variants = [
  [0, 5, 2],
  [4, 1],
  [5, 3, 0],
  [2, 4],
  [1, 5, 3],
  [3, 2, 4],
];

const placements = [
  "translate(96 2) rotate(-8 80 80) scale(0.94)",
  "translate(18 64) rotate(15 80 80) scale(0.48)",
  "translate(227 62) rotate(12 80 80) scale(0.38)",
];

const trails = [
  [
    "M3 53 C30 15 51 26 59 40 S92 55 103 29 S134 9 147 16",
    "M30 151 C58 129 72 161 99 144 S127 124 145 141",
    "M208 21 C230 12 241 40 263 35 S286 22 298 29",
  ],
  [
    "M7 19 C27 41 42 11 63 27 S85 63 105 48",
    "M18 139 C44 159 59 128 82 143 S115 167 136 154",
  ],
  [
    "M5 91 C26 80 18 46 46 43 S70 19 83 14",
    "M99 158 C117 137 137 163 155 149 S179 134 194 149",
    "M218 16 C235 32 247 14 262 27 S283 46 296 35",
  ],
  [
    "M4 38 C25 15 46 43 61 29 S80 10 99 18",
    "M38 155 C57 136 75 163 94 148 S122 134 137 148",
  ],
  [
    "M8 109 C29 92 18 62 43 56 S63 30 79 23",
    "M79 156 C100 137 119 164 138 149 S168 131 185 145",
    "M208 21 C225 9 244 37 259 29 S282 18 297 29",
  ],
  [
    "M5 27 C29 47 42 13 61 29 S79 55 99 43",
    "M20 148 C41 127 60 158 80 142 S107 131 123 144",
    "M218 16 C237 29 250 12 269 26 S287 40 298 33",
  ],
];

interface ObjectProps {
  kind: number;
}

function IllustrationObject(props: ObjectProps) {
  return (
    <>
      {props.kind === 0 ? (
        <>
          <Path d="M18 102 L116 39 Q120 37 123 42 L132 57 Q134 61 130 64 L32 126 Q28 128 25 123 L17 108 Q15 104 18 102 Z" />
          <Path d="M26 99 l6 10 M37 92 l4 6 M48 85 l6 10 M59 78 l4 6 M70 71 l6 10 M81 64 l4 6 M92 57 l6 10 M103 50 l4 6 M114 43 l6 10" />
          <Path d="M25 128 L133 61 M20 103 L115 42" opacity={0.55} />
        </>
      ) : null}
      {props.kind === 1 ? (
        <>
          <Circle cx={80} cy={37} r={10} />
          <Path d="M76 26 L76 15 Q80 12 84 15 L84 26 M73 45 L36 132 L42 143 L49 133 L82 48 M87 45 L121 132 L128 143 L130 132 L88 44" />
          <Path
            d="M49 91 Q80 106 111 91 M48 94 Q80 110 113 94 M73 51 L42 130 M90 52 L124 130"
            opacity={0.65}
          />
          <Circle cx={80} cy={37} r={3} />
        </>
      ) : null}
      {props.kind === 2 ? (
        <>
          <Path d="M30 25 Q32 18 39 18 L115 20 Q122 20 123 27 L122 51 Q121 57 114 58 L39 56 Q31 56 30 50 Z" />
          <Path d="M43 19 Q37 37 42 55 M108 20 Q114 37 109 56 M122 37 L133 38 Q138 38 138 44 L138 67 Q138 76 128 77 L83 77 Q77 77 77 84 L77 91 M83 91 L83 79" />
          <Path d="M72 91 Q72 88 76 88 L84 88 Q88 88 88 92 L87 137 Q86 142 82 143 L77 143 Q73 142 73 137 Z M35 31 Q56 28 77 31 M39 49 Q72 52 110 49" />
        </>
      ) : null}
      {props.kind === 3 ? (
        <>
          <Path d="M27 42 L34 31 Q44 24 56 29 L78 37 L90 37 L96 43 L91 51 L80 53 L72 47 L59 47 L55 55 L45 57 L35 53 L27 53 Z" />
          <Path d="M56 54 L71 58 L51 131 Q49 139 42 137 L38 135 Q33 133 35 126 Z M55 60 L68 64 M40 126 L47 129 M30 42 L43 40 M46 31 Q55 30 63 35" />
        </>
      ) : null}
      {props.kind === 4 ? (
        <>
          <Path d="M17 57 Q18 53 23 53 L137 53 Q142 54 142 59 L141 103 Q141 108 136 108 L22 107 Q17 107 17 102 Z" />
          <Rect x={57} y={64} width={46} height={30} rx={8} />
          <Circle cx={80} cy={79} r={9} />
          <Path d="M72 72 L72 86 M88 72 L88 86 M26 62 L48 62 M112 98 L134 98 M22 103 L136 104" />
          <Circle cx={31} cy={80} r={4} />
          <Circle cx={129} cy={80} r={4} />
        </>
      ) : null}
      {props.kind === 5 ? (
        <>
          <Path d="M65 79 Q42 71 42 49 Q42 24 67 21 Q93 19 97 44 Q99 63 82 75 L82 105 L91 105 L91 114 L82 114 L82 123 L89 123 L89 132 L80 141 L65 132 Z" />
          <Circle cx={69} cy={48} r={12} />
          <Path d="M67 82 L68 128 M46 47 Q48 27 68 25 M75 84 L75 123" />
        </>
      ) : null}
    </>
  );
}

export function BannerIllustration(props: Props) {
  const objects = variants[props.illustration] ?? variants[0];
  const paths = trails[props.illustration] ?? trails[0];

  return (
    <View pointerEvents="none" accessible={false} style={styles.frame}>
      <Svg
        viewBox="0 0 300 170"
        width="100%"
        height="100%"
        fill="none"
        stroke="#FFF7EA"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <G opacity={0.7} strokeWidth={1.6} strokeDasharray="1 7">
          {paths.map((path) => (
            <Path key={path} d={path} />
          ))}
        </G>

        <G opacity={0.35} strokeWidth={1}>
          <Path d="M51 55 l0 8 M47 59 l8 0 M239 30 l0 10 M234 35 l10 0 M226 132 l0 7 M222 135.5 l8 0" />
          <Circle cx={82} cy={29} r={2} />
          <Circle cx={220} cy={151} r={2} />
        </G>

        {objects.map((kind, index) => (
          <G
            key={kind}
            opacity={index === 0 ? 1 : 0.75}
            transform={placements[index]}
          >
            <IllustrationObject kind={kind} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 250,
    height: 158,
    opacity: 0.23,
  },
});
