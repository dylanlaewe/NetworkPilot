import type { Metadata } from "next";
import { ExperiencePrototype } from "./experience-prototype";

export const metadata: Metadata = {
  title: "NetworkPilot — Experience Reset Prototype",
  description: "A synthetic, side-effect-free prototype of NetworkPilot's new interaction model.",
};

export default function ExperienceResetPage() {
  return <ExperiencePrototype />;
}
