import type { PoseId, PracticeId } from "./types";
export const postures: {
  id: PoseId;
  name: string;
  english: string;
  intro: string;
  instruction: string;
  cues: string[];
  focus: string;
}[] = [
  {
    id: "sukhasana",
    name: "Sukhasana",
    english: "Easy Pose",
    intro: "A comfortable crossed-leg seat for a quiet, attentive practice.",
    instruction:
      "Sit with legs comfortably crossed, spine tall and hands resting on your knees. Use a cushion if helpful.",
    cues: [
      "Let your shoulders settle naturally",
      "Balance your weight across your seat",
      "Choose a comfortable leg position",
    ],
    focus: "Spine, hips & a balanced seat",
  },
  {
    id: "padmasana",
    name: "Padmasana",
    english: "Lotus Pose",
    intro:
      "A traditional meditation seat with each foot resting on the opposite thigh.",
    instruction:
      "Only if comfortable and familiar, rest each foot on the opposite thigh. Keep your spine tall. Never force your knees.",
    cues: [
      "Enter only within a comfortable range",
      "Keep your torso upright",
      "Choose Easy Pose if there is discomfort",
    ],
    focus: "Stable seat & upright torso",
  },
  {
    id: "vajrasana",
    name: "Vajrasana",
    english: "Thunderbolt Pose",
    intro: "A kneeling seat with the hips resting gently toward the heels.",
    instruction:
      "Kneel with knees comfortably together and sit toward your heels. Add support under your seat or ankles as needed.",
    cues: [
      "Keep weight balanced over your seat",
      "Let your shoulders settle",
      "Use support for comfort",
    ],
    focus: "Knees, ankles & torso alignment",
  },
  {
    id: "ardha",
    name: "Ardha Padmasana",
    english: "Half Lotus Pose",
    intro:
      "An intermediate meditation seat with one foot on the opposite thigh.",
    instruction:
      "If comfortable, place one foot on the opposite thigh and the other below the opposite knee. Sit evenly; never force the position.",
    cues: [
      "Balance your seat evenly",
      "Keep the spine comfortably tall",
      "Change sides between practices",
    ],
    focus: "Hip symmetry & a balanced seat",
  },
];
export const practices: {
  id: PracticeId;
  name: string;
  subtitle: string;
  description: string;
  instruction: string;
  inhale: number;
  exhale: number;
  pause: number;
}[] = [
  {
    id: "natural",
    name: "Natural Breath",
    subtitle: "Observe your own rhythm",
    description: "A little space to notice the breath, exactly as it is.",
    instruction:
      "Breathe naturally. Live Mirror follows visible upper-torso movement when a reliable signal is available. No timing is prescribed.",
    inhale: 0,
    exhale: 0,
    pause: 0,
  },
  {
    id: "nadi",
    name: "Nadi Shodhana",
    subtitle: "Alternate-nostril breathing",
    description:
      "A gentle alternating sequence, with no required breath retention.",
    instruction:
      "Close the right nostril, inhale left. Switch and exhale right; inhale right, switch and exhale left. Use a light touch. Camera sensing cannot verify nostril airflow.",
    inhale: 4,
    exhale: 4,
    pause: 0,
  },
  {
    id: "bhramari",
    name: "Bhramari",
    subtitle: "Humming breath",
    description:
      "A comfortable inhale followed by a soft, unforced humming exhale.",
    instruction:
      "Inhale gently through the nose, then hum softly as you exhale. Keep your face relaxed. Humming is guided, not detected.",
    inhale: 4,
    exhale: 6,
    pause: 2,
  },
  {
    id: "equal",
    name: "Equal Breathing",
    subtitle: "A balanced rhythm",
    description: "Match the length of a comfortable inhale and exhale.",
    instruction:
      "Breathe in gently, then breathe out for the same length. Shorten the timing whenever you need.",
    inhale: 4,
    exhale: 4,
    pause: 0,
  },
  {
    id: "longer",
    name: "Longer Exhalation",
    subtitle: "An unhurried release",
    description: "Give the exhale a little more time, without strain.",
    instruction:
      "Inhale gently, then let the exhale lengthen comfortably. Return to natural breathing if the timing feels demanding.",
    inhale: 4,
    exhale: 6,
    pause: 0,
  },
  {
    id: "custom",
    name: "Custom",
    subtitle: "Make room for your rhythm",
    description:
      "Choose comfortable timing, an optional pause and a session length.",
    instruction:
      "Choose an easy rhythm. Pauses are optional. Never force the breath; stop if you feel uncomfortable or dizzy.",
    inhale: 4,
    exhale: 6,
    pause: 0,
  },
];
